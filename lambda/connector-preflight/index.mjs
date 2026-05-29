import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
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
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "default";

// Timeout strategy (ms)
const PER_CONNECTOR_TIMEOUT = 8000;
const SECRET_RETRIEVAL_TIMEOUT = 3000;
const AUTH_CHECK_TIMEOUT = 3000;
const PERMISSION_CHECK_TIMEOUT = 3000;
const CONNECTIVITY_CHECK_TIMEOUT = 2000;

// TTL: 30 days
const TTL_DAYS = 30;

// ─── AWS Clients ─────────────────────────────────────────────────────────────

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const secretsClient = new SecretsManagerClient({ region: REGION });
const eventBridge = new EventBridgeClient({ region: REGION });

// ─── Structured Logger ───────────────────────────────────────────────────────

function log(level, fields) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    service: "connector-preflight",
    ...fields,
  };
  const out = JSON.stringify(entry);
  if (level === "ERROR") console.error(out);
  else if (level === "WARN") console.warn(out);
  else console.log(out);
}

// ─── Validation Checks ───────────────────────────────────────────────────────

async function retrieveSecret(secretRef, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SECRET_RETRIEVAL_TIMEOUT);
  if (signal?.aborted) throw new Error("Parent aborted");

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const res = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretRef }),
      { abortSignal: controller.signal }
    );
    return JSON.parse(res.SecretString);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function checkAuth(connectorType, secret, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT);
  if (signal?.aborted) return { name: "auth", status: "TIMEOUT", message: "Parent aborted" };

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (controller.signal.aborted) {
      return { name: "auth", status: "TIMEOUT", message: "Auth check timed out" };
    }
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
    signal?.removeEventListener("abort", onAbort);
  }
}

async function checkPermissions(connectorType, secret, config, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PERMISSION_CHECK_TIMEOUT);
  if (signal?.aborted) return { name: "permissions", status: "TIMEOUT", message: "Parent aborted" };

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (controller.signal.aborted) {
      return { name: "permissions", status: "TIMEOUT", message: "Permissions check timed out" };
    }
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
    signal?.removeEventListener("abort", onAbort);
  }
}

async function checkConnectivity(connectorType, config, signal) {
  const endpoint = getEndpointForType(connectorType, config);
  if (!endpoint) {
    return { name: "connectivity", status: "FAILED", message: "No endpoint configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT);
  if (signal?.aborted) return { name: "connectivity", status: "TIMEOUT", message: "Parent aborted" };

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "agentis-connector-preflight/1.0" },
    });
    const elapsed = Date.now() - start;
    if (res.ok || res.status === 401 || res.status === 403) {
      return { name: "connectivity", status: "PASSED", message: `API responded in ${elapsed}ms` };
    }
    return { name: "connectivity", status: "FAILED", message: `Endpoint returned ${res.status} in ${elapsed}ms` };
  } catch (err) {
    if (err.name === "AbortError") {
      return { name: "connectivity", status: "TIMEOUT", message: "Connectivity check timed out" };
    }
    return { name: "connectivity", status: "FAILED", message: err.message };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
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
  const { connectorId, connectorType, secretRef } = connector;
  const start = Date.now();

  const controller = new AbortController();
  const perConnectorTimeout = setTimeout(() => controller.abort(), PER_CONNECTOR_TIMEOUT);

  try {
    let secret;
    try {
      secret = await retrieveSecret(secretRef, controller.signal);
    } catch (err) {
      const durationMs = Date.now() - start;
      log("ERROR", {
        traceId,
        connectorId,
        connectorType,
        action: "validate",
        status: "FAILED",
        message: `Secret retrieval failed: ${err.message}`,
      });
      return {
        connectorId,
        connectorType,
        status: "FAILED",
        durationMs,
        checks: [{ name: "secret", status: "FAILED", message: err.message }],
      };
    }

    const checks = await Promise.all([
      checkAuth(connectorType, secret, controller.signal),
      checkPermissions(connectorType, secret, connector, controller.signal),
      checkConnectivity(connectorType, connector, controller.signal),
    ]);

    const durationMs = Date.now() - start;
    const allPassed = checks.every((c) => c.status === "PASSED");
    const hasTimeout = checks.some((c) => c.status === "TIMEOUT");
    const status = allPassed ? "VALID" : hasTimeout ? "TIMEOUT" : "INVALID";

    log("INFO", {
      traceId,
      connectorId,
      connectorType,
      action: "validate",
      status,
      durationMs,
      checks: checks.map((c) => `${c.name}:${c.status}`),
    });

    return { connectorId, connectorType, status, durationMs, checks };
  } finally {
    clearTimeout(perConnectorTimeout);
  }
}

// ─── Persist Validation Results ──────────────────────────────────────────────

async function persistValidationResult(workflowId, connectorResults, traceId) {
  const validatedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

  await ddb.send(
    new PutCommand({
      TableName: VALIDATIONS_TABLE,
      Item: {
        workflowId,
        validatedAt,
        connectors: connectorResults,
        traceId,
        ttl,
      },
    })
  );
}

// ─── Workflow Lookup ──────────────────────────────────────────────────────────

async function getWorkflow(workflowId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflowId },
    })
  );
  return res.Item || null;
}

// ─── Connector Lookup ────────────────────────────────────────────────────────

async function getConnectorsByIds(connectorIds) {
  const results = [];
  for (const id of connectorIds) {
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

// ─── Ticket Update ───────────────────────────────────────────────────────────

async function updateTicketValidationStatus(ticketId, status) {
  await ddb.send(
    new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression:
        "SET validationStatus = :status, validatedAt = :ts",
      ExpressionAttributeValues: {
        ":status": status,
        ":ts": new Date().toISOString(),
      },
    })
  );
}

// ─── EventBridge Publishing ──────────────────────────────────────────────────

async function publishValidationEvent(detail, detailType) {
  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "agentis.connector-preflight",
          DetailType: detailType,
          EventBusName: EVENT_BUS_NAME,
          Detail: JSON.stringify(detail),
        },
      ],
    })
  );
}

// ─── Stream Trigger Handler ──────────────────────────────────────────────────

async function handleStreamEvent(records, traceId) {
  const results = [];

  for (const record of records) {
    if (record.eventName !== "INSERT") continue;

    const ticket = record.dynamodb?.NewImage;
    if (!ticket) continue;

    const ticketId = ticket.ticketId?.S;
    const workflowId = ticket.workflowId?.S;

    if (!ticketId || !workflowId) {
      log("WARN", { traceId, action: "stream", message: "Record missing ticketId or workflowId" });
      continue;
    }

    log("INFO", { traceId, ticketId, workflowId, action: "stream.process" });

    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      log("WARN", { traceId, ticketId, workflowId, action: "stream.process", message: "Workflow not found" });
      await updateTicketValidationStatus(ticketId, "PASSED");
      continue;
    }

    const requiredConnectorIds = workflow.connectors || [];

    if (requiredConnectorIds.length === 0) {
      log("INFO", { traceId, ticketId, workflowId, action: "stream.process", message: "No connectors required" });
      await updateTicketValidationStatus(ticketId, "PASSED");
      await publishValidationEvent(
        { ticketId, workflowId, status: "PASSED", connectors: [], traceId },
        "VALIDATION_PASSED"
      );
      results.push({ ticketId, workflowId, status: "PASSED" });
      continue;
    }

    const connectors = await getConnectorsByIds(requiredConnectorIds);

    const connectorResults = await Promise.allSettled(
      connectors.map((c) => validateConnector(c, traceId))
    );

    const validationResults = connectorResults.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        connectorId: connectors[i].connectorId,
        connectorType: connectors[i].connectorType,
        status: "FAILED",
        durationMs: 0,
        checks: [{ name: "execution", status: "FAILED", message: r.reason?.message || "Unknown error" }],
      };
    });

    const allValid = validationResults.every((r) => r.status === "VALID");
    const ticketStatus = allValid ? "PASSED" : "VALIDATION_FAILED";
    const eventType = allValid ? "VALIDATION_PASSED" : "VALIDATION_FAILED";

    await updateTicketValidationStatus(ticketId, ticketStatus);

    await persistValidationResult(workflowId, validationResults, traceId);

    await publishValidationEvent(
      {
        ticketId,
        workflowId,
        status: ticketStatus,
        connectors: validationResults.map((r) => ({
          connectorId: r.connectorId,
          type: r.connectorType,
          status: r.status,
        })),
        traceId,
      },
      eventType
    );

    log("INFO", {
      traceId,
      ticketId,
      workflowId,
      action: "stream.complete",
      status: ticketStatus,
      connectorCount: validationResults.length,
      validCount: validationResults.filter((r) => r.status === "VALID").length,
    });

    results.push({ ticketId, workflowId, status: ticketStatus, connectors: validationResults });
  }

  return results;
}

// ─── Manual Invocation Handler ───────────────────────────────────────────────

async function handleManualInvocation(workflowId, traceId) {
  log("INFO", { traceId, workflowId, action: "manual.start" });

  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    log("ERROR", { traceId, workflowId, action: "manual.start", message: "Workflow not found" });
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Workflow not found", workflowId }),
    };
  }

  const requiredConnectorIds = workflow.connectors || [];

  if (requiredConnectorIds.length === 0) {
    log("INFO", { traceId, workflowId, action: "manual.complete", message: "No connectors required" });
    return {
      workflowId,
      status: "READY",
      connectors: [],
    };
  }

  const connectors = await getConnectorsByIds(requiredConnectorIds);
  const requiredSet = new Set(workflow.requiredConnectors || requiredConnectorIds);

  const connectorResults = await Promise.allSettled(
    connectors.map((c) => validateConnector(c, traceId))
  );

  const results = connectorResults.map((r, i) => {
    const connector = connectors[i];
    const isRequired = requiredSet.has(connector.connectorId);
    if (r.status === "fulfilled") {
      return {
        connectorId: r.value.connectorId,
        type: r.value.connectorType,
        required: isRequired,
        status: r.value.status,
      };
    }
    return {
      connectorId: connector.connectorId,
      type: connector.connectorType,
      required: isRequired,
      status: "FAILED",
    };
  });

  await persistValidationResult(workflowId, results, traceId);

  const allReady = results
    .filter((r) => r.required)
    .every((r) => r.status === "VALID");
  const overallStatus = allReady ? "READY" : "NOT_READY";

  log("INFO", {
    traceId,
    workflowId,
    action: "manual.complete",
    status: overallStatus,
    connectorCount: results.length,
    validCount: results.filter((r) => r.status === "VALID").length,
  });

  return {
    workflowId,
    status: overallStatus,
    connectors: results,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handler(event, context) {
  const traceId = context?.awsRequestId || uuidv4();

  log("INFO", {
    traceId,
    action: "invocation",
    triggerType: event.Records ? "STREAM" : "MANUAL",
  });

  try {
    if (event.Records) {
      const results = await handleStreamEvent(event.Records, traceId);
      log("INFO", { traceId, action: "complete", triggerType: "STREAM", ticketsProcessed: results.length });
      return { statusCode: 200, body: JSON.stringify({ results }) };
    }

    if (event.workflowId) {
      const result = await handleManualInvocation(event.workflowId, traceId);
      if (result.statusCode) return result;
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    log("ERROR", { traceId, action: "invocation", message: "Invalid event: no Records or workflowId" });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Must provide DynamoDB Stream Records or workflowId" }),
    };
  } catch (err) {
    log("ERROR", { traceId, action: "handler", message: err.message, stack: err.stack });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal error", message: err.message }),
    };
  }
}
