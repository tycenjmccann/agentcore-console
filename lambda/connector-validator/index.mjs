import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
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

// ─── Config ────────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const VALIDATIONS_TABLE = process.env.VALIDATIONS_TABLE || "connector-validations";
const CIRCUIT_BREAKERS_TABLE = process.env.CIRCUIT_BREAKERS_TABLE || "connector-circuit-breakers";
const IDEMPOTENCY_TABLE = process.env.IDEMPOTENCY_TABLE || "validation-idempotency-keys";
const EVENT_BUS = process.env.EVENT_BUS || "default";

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TTL_SECONDS = 300; // 5 minutes

const VALIDATION_STEPS = ["auth", "connectivity", "permissions", "data-flow"];

// ─── Clients ───────────────────────────────────────────────────────────────────

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const secrets = new SecretsManagerClient({ region: REGION });
const events = new EventBridgeClient({ region: REGION });

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function handler(event) {
  const traceId = process.env._X_AMZN_TRACE_ID || uuidv4();

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { validationId, connectorId, connectorType, steps, config } = message;

    const log = (level, msg, extra = {}) => {
      console.log(JSON.stringify({
        level,
        message: msg,
        traceId,
        validationId,
        connectorId,
        connectorType,
        timestamp: new Date().toISOString(),
        ...extra,
      }));
    };

    log("info", "Processing validation request");

    try {
      // Check circuit breaker state
      const circuitState = await getCircuitBreakerState(connectorId);
      if (circuitState && circuitState.state === "open") {
        const now = Math.floor(Date.now() / 1000);
        if (circuitState.resetAt > now) {
          log("warn", "Circuit breaker is OPEN, failing fast", {
            failureCount: circuitState.failureCount,
            resetAt: circuitState.resetAt,
          });
          await updateValidationStatus(validationId, "failed", {
            failureReason: "circuit_open",
            failedAt: new Date().toISOString(),
          });
          await publishEvent("validation.failed", { validationId, connectorId, reason: "circuit_open" });
          continue;
        }
      }

      // Transition: pending → running
      await updateValidationStatus(validationId, "running", {
        startedAt: new Date().toISOString(),
      });
      log("info", "Validation status updated to running");

      // Execute validation steps sequentially
      const stepsToRun = steps || VALIDATION_STEPS;
      const stepResults = [];
      let failed = false;

      for (const step of stepsToRun) {
        log("info", `Executing validation step: ${step}`, { step });

        await updateStepStatus(validationId, step, "running");

        try {
          const result = await executeStep(step, connectorId, connectorType, config, log);
          stepResults.push({ step, status: "passed", result });
          await updateStepStatus(validationId, step, "passed");
          log("info", `Step passed: ${step}`, { step });
        } catch (stepError) {
          if (isRetryable(stepError)) {
            log("warn", `Retryable error on step: ${step}, retrying`, { step, error: stepError.message });
            const retryResult = await retryWithBackoff(() =>
              executeStep(step, connectorId, connectorType, config, log), 3, log
            );

            if (retryResult.success) {
              stepResults.push({ step, status: "passed", result: retryResult.value });
              await updateStepStatus(validationId, step, "passed");
              log("info", `Step passed after retry: ${step}`, { step });
              continue;
            }
          }

          stepResults.push({ step, status: "failed", error: stepError.message });
          await updateStepStatus(validationId, step, "failed", stepError.message);
          log("error", `Step failed: ${step}`, { step, error: stepError.message });

          // Update circuit breaker
          await incrementCircuitBreaker(connectorId, log);

          // Mark validation as failed
          await updateValidationStatus(validationId, "failed", {
            failureReason: stepError.message,
            failedStep: step,
            failedAt: new Date().toISOString(),
            stepResults,
          });
          await publishEvent("validation.failed", {
            validationId,
            connectorId,
            failedStep: step,
            reason: stepError.message,
          });

          failed = true;
          break;
        }
      }

      if (!failed) {
        await updateValidationStatus(validationId, "passed", {
          completedAt: new Date().toISOString(),
          stepResults,
        });
        await publishEvent("validation.passed", { validationId, connectorId });
        log("info", "All validation steps passed");
      }
    } catch (err) {
      log("error", "Unexpected error during validation", { error: err.message, stack: err.stack });
      await updateValidationStatus(validationId, "failed", {
        failureReason: `unexpected_error: ${err.message}`,
        failedAt: new Date().toISOString(),
      });
      await publishEvent("validation.failed", {
        validationId,
        connectorId,
        reason: `unexpected_error: ${err.message}`,
      });
    }
  }

  return { statusCode: 200 };
}

// ─── Step Execution ────────────────────────────────────────────────────────────

async function executeStep(step, connectorId, connectorType, config, log) {
  switch (step) {
    case "auth":
      return executeAuthStep(connectorId, connectorType, config, log);
    case "connectivity":
      return executeConnectivityStep(connectorId, connectorType, config, log);
    case "permissions":
      return executePermissionsStep(connectorId, connectorType, config, log);
    case "data-flow":
      return executeDataFlowStep(connectorId, connectorType, config, log);
    default:
      throw new Error(`Unknown validation step: ${step}`);
  }
}

async function executeAuthStep(connectorId, connectorType, config, log) {
  const secretId = config?.secretId || `connector/${connectorId}/credentials`;
  log("info", "Retrieving credentials from Secrets Manager", { secretId });

  const { SecretString } = await secrets.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!SecretString) {
    throw new Error("Credentials not found or empty");
  }

  const creds = JSON.parse(SecretString);

  if (!creds.apiKey && !creds.accessToken && !creds.username) {
    throw new Error("Invalid credential format: missing required fields");
  }

  return { verified: true, credentialType: creds.apiKey ? "api_key" : creds.accessToken ? "oauth" : "basic" };
}

async function executeConnectivityStep(connectorId, connectorType, config, log) {
  const endpoint = config?.endpoint;
  if (!endpoint) {
    throw new Error("No endpoint configured for connectivity check");
  }

  log("info", "Testing connectivity to endpoint", { endpoint });

  // Simulate connectivity test — in production, this would make an actual HTTP request
  const startTime = Date.now();
  await simulateNetworkCall(endpoint);
  const latencyMs = Date.now() - startTime;

  return { reachable: true, latencyMs, endpoint };
}

async function executePermissionsStep(connectorId, connectorType, config, log) {
  const requiredScopes = config?.requiredScopes || [];
  log("info", "Verifying permissions and scopes", { requiredScopes });

  // Simulate permission verification
  const grantedScopes = await simulatePermissionCheck(connectorId, requiredScopes);
  const missingScopes = requiredScopes.filter((s) => !grantedScopes.includes(s));

  if (missingScopes.length > 0) {
    throw new Error(`Missing required scopes: ${missingScopes.join(", ")}`);
  }

  return { verified: true, grantedScopes };
}

async function executeDataFlowStep(connectorId, connectorType, config, log) {
  log("info", "Attempting data flow test");

  // Simulate a small data transfer to verify end-to-end flow
  const testPayload = { test: true, timestamp: new Date().toISOString(), connectorId };
  const result = await simulateDataTransfer(connectorId, testPayload);

  if (!result.acknowledged) {
    throw new Error("Data flow test: remote did not acknowledge transfer");
  }

  return { acknowledged: true, bytesTransferred: result.bytesTransferred };
}

// ─── Simulation Helpers (replace with real implementations) ────────────────────

async function simulateNetworkCall(endpoint) {
  // Simulate network latency
  await sleep(50 + Math.random() * 100);
  if (endpoint.includes("unreachable")) {
    throw new NetworkError("Connection timed out");
  }
}

async function simulatePermissionCheck(connectorId, requiredScopes) {
  await sleep(20);
  // In production, query the connector's OAuth provider or IAM
  return requiredScopes;
}

async function simulateDataTransfer(connectorId, payload) {
  await sleep(30 + Math.random() * 50);
  return { acknowledged: true, bytesTransferred: JSON.stringify(payload).length };
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────────

async function getCircuitBreakerState(connectorId) {
  const { Item } = await ddb.send(new GetCommand({
    TableName: CIRCUIT_BREAKERS_TABLE,
    Key: { connectorId },
  }));
  return Item || null;
}

async function incrementCircuitBreaker(connectorId, log) {
  const current = await getCircuitBreakerState(connectorId);
  const failureCount = (current?.failureCount || 0) + 1;
  const now = Math.floor(Date.now() / 1000);

  const item = {
    connectorId,
    failureCount,
    lastFailureAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    item.state = "open";
    item.resetAt = now + CIRCUIT_BREAKER_TTL_SECONDS;
    log("warn", "Circuit breaker OPENED", { connectorId, failureCount, resetAt: item.resetAt });
  } else {
    item.state = current?.state || "closed";
    item.resetAt = current?.resetAt;
  }

  await ddb.send(new PutCommand({
    TableName: CIRCUIT_BREAKERS_TABLE,
    Item: item,
  }));
}

// ─── DynamoDB Helpers ──────────────────────────────────────────────────────────

async function updateValidationStatus(validationId, status, attributes = {}) {
  const expressionParts = ["#status = :status", "#updatedAt = :updatedAt"];
  const names = { "#status": "status", "#updatedAt": "updatedAt" };
  const values = { ":status": status, ":updatedAt": new Date().toISOString() };

  for (const [key, value] of Object.entries(attributes)) {
    const attrKey = `#${key}`;
    const valKey = `:${key}`;
    expressionParts.push(`${attrKey} = ${valKey}`);
    names[attrKey] = key;
    values[valKey] = value;
  }

  await ddb.send(new UpdateCommand({
    TableName: VALIDATIONS_TABLE,
    Key: { validationId },
    UpdateExpression: `SET ${expressionParts.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

async function updateStepStatus(validationId, step, status, errorMessage) {
  const stepKey = `steps.${step}`;
  const values = {
    ":stepStatus": status,
    ":stepUpdatedAt": new Date().toISOString(),
  };
  let updateExpr = `SET #stepKey.#status = :stepStatus, #stepKey.#updatedAt = :stepUpdatedAt`;
  const names = {
    "#stepKey": stepKey,
    "#status": "status",
    "#updatedAt": "updatedAt",
  };

  if (errorMessage) {
    updateExpr += `, #stepKey.#error = :error`;
    names["#error"] = "error";
    values[":error"] = errorMessage;
  }

  try {
    await ddb.send(new UpdateCommand({
      TableName: VALIDATIONS_TABLE,
      Key: { validationId },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  } catch {
    // If nested path doesn't exist, initialize it
    await ddb.send(new UpdateCommand({
      TableName: VALIDATIONS_TABLE,
      Key: { validationId },
      UpdateExpression: `SET #steps = if_not_exists(#steps, :emptyMap)`,
      ExpressionAttributeNames: { "#steps": "steps" },
      ExpressionAttributeValues: { ":emptyMap": {} },
    }));

    await ddb.send(new UpdateCommand({
      TableName: VALIDATIONS_TABLE,
      Key: { validationId },
      UpdateExpression: `SET #steps.#step = :stepData`,
      ExpressionAttributeNames: { "#steps": "steps", "#step": step },
      ExpressionAttributeValues: {
        ":stepData": { status, updatedAt: new Date().toISOString(), ...(errorMessage && { error: errorMessage }) },
      },
    }));
  }
}

// ─── EventBridge ───────────────────────────────────────────────────────────────

async function publishEvent(detailType, detail) {
  await events.send(new PutEventsCommand({
    Entries: [{
      Source: "connector-validator",
      DetailType: detailType,
      Detail: JSON.stringify(detail),
      EventBusName: EVENT_BUS,
    }],
  }));
}

// ─── Retry with Exponential Backoff + Jitter ───────────────────────────────────

async function retryWithBackoff(fn, maxRetries, log) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { success: true, value };
    } catch (err) {
      if (attempt === maxRetries || !isRetryable(err)) {
        return { success: false, error: err };
      }
      const baseDelay = Math.pow(2, attempt) * 100;
      const jitter = Math.random() * baseDelay;
      const delay = baseDelay + jitter;
      log("info", `Retry attempt ${attempt}/${maxRetries}, waiting ${Math.round(delay)}ms`, {
        attempt,
        maxRetries,
        delayMs: Math.round(delay),
      });
      await sleep(delay);
    }
  }
  return { success: false };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function isRetryable(error) {
  const retryableCodes = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ThrottlingException", "TooManyRequestsException"];
  return retryableCodes.includes(error.code) || error instanceof NetworkError;
}

class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
    this.code = "ETIMEDOUT";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
