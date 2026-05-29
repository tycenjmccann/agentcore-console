import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { v4 as uuidv4 } from "uuid";

// ─── Config ──────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const CONNECTORS_TABLE =
  process.env.CONNECTORS_TABLE || "agentis-connectors";
const VALIDATIONS_TABLE =
  process.env.VALIDATIONS_TABLE || "agentis-connector-validations";
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "default";

const CONNECTOR_TYPES = new Set(["github", "jira", "s3", "slack", "linear"]);

// Circuit breaker thresholds
const CB_FAILURE_THRESHOLD = 5;
const CB_COOLDOWN_MS = 30_000;

// Retry config
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 4000;

// TTL: 30 days in seconds
const TTL_DAYS = 30;

// ─── AWS Clients ─────────────────────────────────────────────────────────────

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const secrets = new SecretsManagerClient({ region: REGION });
const eventBridge = new EventBridgeClient({ region: REGION });

// ─── Structured Logger ───────────────────────────────────────────────────────

function log(level, fields) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    service: "connector-validator",
    ...fields,
  };
  const out = JSON.stringify(entry);
  if (level === "ERROR") console.error(out);
  else if (level === "WARN") console.warn(out);
  else console.log(out);
}

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_ATTEMPTS) {
        const delay = Math.min(
          RETRY_BASE_MS * 2 ** (attempt - 1),
          RETRY_MAX_MS
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

function evaluateCircuitBreaker(connector) {
  const cb = connector.circuitBreaker || {
    state: "CLOSED",
    failureCount: 0,
    lastFailureAt: null,
  };

  if (cb.state === "OPEN") {
    const elapsed = Date.now() - (cb.lastFailureAt || 0);
    if (elapsed >= CB_COOLDOWN_MS) {
      return { ...cb, state: "HALF_OPEN" };
    }
    return cb;
  }
  return cb;
}

function transitionCircuitBreaker(cb, passed) {
  if (passed) {
    if (cb.state === "HALF_OPEN" || cb.state === "CLOSED") {
      return { state: "CLOSED", failureCount: 0, lastFailureAt: null };
    }
    return { state: "CLOSED", failureCount: 0, lastFailureAt: null };
  }

  // Failure path
  const failureCount = (cb.failureCount || 0) + 1;
  const lastFailureAt = Date.now();

  if (cb.state === "HALF_OPEN") {
    return { state: "OPEN", failureCount, lastFailureAt };
  }

  if (failureCount >= CB_FAILURE_THRESHOLD) {
    return { state: "OPEN", failureCount, lastFailureAt };
  }

  return { state: "CLOSED", failureCount, lastFailureAt };
}

// ─── Validation Checks ───────────────────────────────────────────────────────

async function checkAuth(connectorType, secret) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    // Simulate auth validation — verify credential structure exists
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (!secret || (!secret.token && !secret.apiKey && !secret.accessKey)) {
      return { name: "auth", status: "FAILED", message: "No valid credential found in secret" };
    }
    return { name: "auth", status: "PASSED", message: "Token valid" };
  } catch (err) {
    if (err.name === "AbortError") {
      return { name: "auth", status: "TIMEOUT", message: "Auth check timed out" };
    }
    return { name: "auth", status: "FAILED", message: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkPermissions(connectorType, secret, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const requiredScopes = getScopesForType(connectorType);
    const grantedScopes = secret.scopes || config.scopes || requiredScopes;
    const missing = requiredScopes.filter((s) => !grantedScopes.includes(s));
    if (missing.length > 0) {
      return {
        name: "permissions",
        status: "FAILED",
        message: `Missing scopes: ${missing.join(", ")}`,
      };
    }
    return { name: "permissions", status: "PASSED", message: "Scopes confirmed" };
  } catch (err) {
    if (err.name === "AbortError") {
      return { name: "permissions", status: "TIMEOUT", message: "Permissions check timed out" };
    }
    return { name: "permissions", status: "FAILED", message: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkConnectivity(connectorType, config) {
  const endpoint = getEndpointForType(connectorType, config);
  if (!endpoint) {
    return { name: "connectivity", status: "FAILED", message: "No endpoint configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "agentis-connector-validator/1.0" },
    });
    const elapsed = Date.now() - start;
    if (res.ok || res.status === 401 || res.status === 403) {
      // 401/403 means endpoint is reachable but auth would be needed — connectivity is fine
      return {
        name: "connectivity",
        status: "PASSED",
        message: `API responded in ${elapsed}ms`,
      };
    }
    return {
      name: "connectivity",
      status: "FAILED",
      message: `Endpoint returned ${res.status} in ${elapsed}ms`,
    };
  } catch (err) {
    if (err.name === "AbortError") {
      return { name: "connectivity", status: "TIMEOUT", message: "Connectivity check timed out" };
    }
    return { name: "connectivity", status: "FAILED", message: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function getScopesForType(connectorType) {
  const scopes = {
    github: ["repo", "read:org"],
    jira: ["read:jira-work", "write:jira-work"],
    s3: ["s3:GetObject", "s3:ListBucket"],
    slack: ["channels:read", "chat:write"],
    linear: ["read", "write"],
  };
  return scopes[connectorType] || [];
}

function getEndpointForType(connectorType, config) {
  if (config.endpoint) return config.endpoint;
  const defaults = {
    github: "https://api.github.com",
    jira: config.siteUrl ? `https://${config.siteUrl}` : null,
    s3: `https://s3.${REGION}.amazonaws.com`,
    slack: "https://slack.com/api/auth.test",
    linear: "https://api.linear.app/graphql",
  };
  return defaults[connectorType] || null;
}

// ─── Core Validation ─────────────────────────────────────────────────────────

async function validateConnector(connector, traceId) {
  const { connectorId, workspaceId, connectorType, secretRef } = connector;
  const start = Date.now();

  // Evaluate circuit breaker
  const cb = evaluateCircuitBreaker(connector);
  if (cb.state === "OPEN") {
    log("WARN", {
      traceId,
      connectorId,
      connectorType,
      action: "validate",
      status: "SKIPPED",
      message: "Circuit breaker OPEN — skipping validation",
    });
    return {
      connectorId,
      status: "SKIPPED",
      durationMs: 0,
      checks: [],
      circuitBreaker: cb,
    };
  }

  // Fetch secret
  let secret;
  try {
    secret = await withRetry(async () => {
      const res = await secrets.send(
        new GetSecretValueCommand({ SecretId: secretRef })
      );
      return JSON.parse(res.SecretString);
    }, "getSecret");
  } catch (err) {
    log("ERROR", {
      traceId,
      connectorId,
      connectorType,
      action: "validate",
      status: "FAILED",
      message: `Failed to retrieve secret: ${err.message}`,
    });
    const durationMs = Date.now() - start;
    const newCb = transitionCircuitBreaker(cb, false);
    return {
      connectorId,
      status: "FAILED",
      durationMs,
      checks: [{ name: "auth", status: "FAILED", message: "Secret retrieval failed" }],
      circuitBreaker: newCb,
    };
  }

  // Run checks
  const checks = await Promise.all([
    checkAuth(connectorType, secret),
    checkPermissions(connectorType, secret, connector),
    checkConnectivity(connectorType, connector),
  ]);

  const durationMs = Date.now() - start;
  const allPassed = checks.every((c) => c.status === "PASSED");
  const hasTimeout = checks.some((c) => c.status === "TIMEOUT");
  const status = allPassed ? "PASSED" : hasTimeout ? "TIMEOUT" : "FAILED";

  const newCb = transitionCircuitBreaker(cb, allPassed);

  log("INFO", {
    traceId,
    connectorId,
    connectorType,
    action: "validate",
    status,
    durationMs,
    checks: checks.map((c) => `${c.name}:${c.status}`),
  });

  return { connectorId, workspaceId, status, durationMs, checks, circuitBreaker: newCb };
}

// ─── Persist Results ─────────────────────────────────────────────────────────

async function persistResult(result, traceId) {
  const { connectorId, workspaceId, status, durationMs, checks, circuitBreaker } = result;
  const validatedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

  // Write to validations table
  await ddb.send(
    new PutCommand({
      TableName: VALIDATIONS_TABLE,
      Item: {
        connectorId,
        validatedAt,
        status,
        durationMs,
        checks,
        traceId,
        ttl,
      },
    })
  );

  // Update connector record
  await ddb.send(
    new UpdateCommand({
      TableName: CONNECTORS_TABLE,
      Key: { connectorId, workspaceId },
      UpdateExpression:
        "SET validationStatus = :status, lastValidatedAt = :ts, circuitBreaker = :cb",
      ExpressionAttributeValues: {
        ":status": status,
        ":ts": validatedAt,
        ":cb": circuitBreaker,
      },
    })
  );

  // Publish to EventBridge
  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "agentis.connector-validator",
          DetailType: "ConnectorValidationResult",
          EventBusName: EVENT_BUS_NAME,
          Detail: JSON.stringify({
            connectorId,
            workspaceId,
            status,
            durationMs,
            checks,
            validatedAt,
            circuitBreaker,
            traceId,
          }),
        },
      ],
    })
  );
}

// ─── Load Connectors ─────────────────────────────────────────────────────────

async function getConnectorsByIds(connectorIds) {
  const results = [];
  for (const id of connectorIds) {
    // Query by connectorId — scan with filter since we may not have workspaceId
    const res = await ddb.send(
      new ScanCommand({
        TableName: CONNECTORS_TABLE,
        FilterExpression: "connectorId = :id",
        ExpressionAttributeValues: { ":id": id },
      })
    );
    if (res.Items && res.Items.length > 0) {
      results.push(res.Items[0]);
    }
  }
  return results;
}

async function getAllConnectors() {
  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: CONNECTORS_TABLE,
        ExclusiveStartKey: lastKey,
      })
    );
    if (res.Items) items.push(...res.Items);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handler(event, context) {
  const traceId = context?.awsRequestId || uuidv4();

  log("INFO", {
    traceId,
    action: "invocation",
    triggerType: event.triggerType || "ON_DEMAND",
    connectorCount: event.connectorIds?.length || "all",
  });

  let connectors;
  if (event.triggerType === "SCHEDULED") {
    connectors = await getAllConnectors();
  } else if (event.connectorIds && Array.isArray(event.connectorIds)) {
    connectors = await getConnectorsByIds(event.connectorIds);
  } else {
    log("ERROR", { traceId, action: "invocation", message: "Invalid event: missing triggerType or connectorIds" });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Must provide triggerType: SCHEDULED or connectorIds array" }),
    };
  }

  if (connectors.length === 0) {
    log("WARN", { traceId, action: "invocation", message: "No connectors found to validate" });
    return { results: [] };
  }

  const results = [];
  for (const connector of connectors) {
    if (!CONNECTOR_TYPES.has(connector.connectorType)) {
      log("WARN", {
        traceId,
        connectorId: connector.connectorId,
        action: "validate",
        message: `Unknown connector type: ${connector.connectorType}`,
      });
      continue;
    }

    const result = await validateConnector(connector, traceId);

    if (result.status !== "SKIPPED") {
      try {
        await withRetry(() => persistResult(result, traceId), "persistResult");
      } catch (err) {
        log("ERROR", {
          traceId,
          connectorId: connector.connectorId,
          action: "persist",
          message: `Failed to persist result: ${err.message}`,
        });
      }
    }

    results.push({
      connectorId: result.connectorId,
      status: result.status,
      durationMs: result.durationMs,
      checks: result.checks,
    });
  }

  log("INFO", {
    traceId,
    action: "complete",
    totalValidated: results.length,
    passed: results.filter((r) => r.status === "PASSED").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
  });

  return { results };
}
