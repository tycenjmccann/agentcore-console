import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

// ─── Config ────────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";
const EVENT_BUS = process.env.EVENT_BUS || "default";
const CIRCUIT_BREAKER_TABLE = process.env.CIRCUIT_BREAKER_TABLE || "connector-circuit-breakers";

const EVENT_SOURCE = "agentis.connector-validation";

const STATUS_TRANSITIONS = {
  "pending->running": "validation.started",
  "running->passed": "validation.completed",
  "running->failed": "validation.failed",
};

// ─── Clients ───────────────────────────────────────────────────────────────────

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const events = new EventBridgeClient({ region: REGION });

// ─── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") {
      continue;
    }

    try {
      await processRecord(record);
    } catch (err) {
      log("error", "Failed to process stream record", {
        eventID: record.eventID,
        error: err.message,
        stack: err.stack,
      });
    }
  }

  return { statusCode: 200 };
};

// ─── Record Processing ─────────────────────────────────────────────────────────

async function processRecord(record) {
  const newImage = unmarshallImage(record.dynamodb.NewImage);
  const oldImage = record.dynamodb.OldImage ? unmarshallImage(record.dynamodb.OldImage) : {};

  const { validationId, connectorId, connectorType, workflowId, steps } = newImage;
  const newStatus = newImage.status;
  const previousStatus = oldImage.status;

  log("info", "Processing stream record", {
    validationId,
    connectorId,
    eventName: record.eventName,
    newStatus,
    previousStatus,
  });

  // Detect status transitions
  if (newStatus && previousStatus && newStatus !== previousStatus) {
    const transitionKey = `${previousStatus}->${newStatus}`;
    const detailType = STATUS_TRANSITIONS[transitionKey];

    if (detailType) {
      log("info", "Status transition detected", { transitionKey, detailType, validationId });

      await publishEvent(detailType, {
        validationId,
        connectorId,
        connectorType,
        status: newStatus,
        previousStatus,
        steps: summarizeSteps(steps),
        timestamp: new Date().toISOString(),
        workflowId: workflowId || undefined,
      });

      if (workflowId) {
        await writeWorkflowEvent(workflowId, validationId, detailType, newStatus);
      }
    }
  }

  // Detect circuit breaker state changes
  await detectCircuitBreakerChanges(record, newImage, oldImage);
}

// ─── Circuit Breaker Detection ─────────────────────────────────────────────────

async function detectCircuitBreakerChanges(record, newImage, oldImage) {
  const tableName = record.eventSourceARN?.includes(CIRCUIT_BREAKER_TABLE);
  if (!tableName) return;

  const newState = newImage.state;
  const oldState = oldImage.state;

  if (newState === oldState) return;

  if (newState === "open" && oldState !== "open") {
    log("info", "Circuit breaker opened", { connectorId: newImage.connectorId });
    await publishEvent("circuit.opened", {
      connectorId: newImage.connectorId,
      failureCount: newImage.failureCount,
      resetAt: newImage.resetAt,
      timestamp: new Date().toISOString(),
    });
  }

  if (newState === "closed" && oldState === "open") {
    log("info", "Circuit breaker closed", { connectorId: newImage.connectorId });
    await publishEvent("circuit.closed", {
      connectorId: newImage.connectorId,
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── EventBridge ───────────────────────────────────────────────────────────────

async function publishEvent(detailType, detail) {
  await events.send(new PutEventsCommand({
    Entries: [{
      Source: EVENT_SOURCE,
      DetailType: detailType,
      Detail: JSON.stringify(detail),
      EventBusName: EVENT_BUS,
    }],
  }));

  log("info", "Published EventBridge event", { detailType, validationId: detail.validationId });
}

// ─── Workflow Event Tracking ───────────────────────────────────────────────────

async function writeWorkflowEvent(workflowId, validationId, detailType, status) {
  await ddb.send(new PutCommand({
    TableName: EVENTS_TABLE,
    Item: {
      workflowId,
      eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: detailType,
      source: EVENT_SOURCE,
      detail: { validationId, status },
      timestamp: new Date().toISOString(),
    },
  }));

  log("info", "Wrote workflow event", { workflowId, validationId, detailType });
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function unmarshallImage(image) {
  const result = {};
  for (const [key, value] of Object.entries(image)) {
    if (value.S) result[key] = value.S;
    else if (value.N) result[key] = Number(value.N);
    else if (value.BOOL !== undefined) result[key] = value.BOOL;
    else if (value.M) result[key] = unmarshallImage(value.M);
    else if (value.L) result[key] = value.L.map((item) => unmarshallImage({ v: item }).v);
    else if (value.NULL) result[key] = null;
  }
  return result;
}

function summarizeSteps(steps) {
  if (!steps || typeof steps !== "object") return undefined;
  const summary = {};
  for (const [step, data] of Object.entries(steps)) {
    summary[step] = typeof data === "object" ? data.status || "unknown" : data;
  }
  return summary;
}

function log(level, message, extra = {}) {
  console.log(JSON.stringify({
    level,
    message,
    service: "validation-results-writer",
    timestamp: new Date().toISOString(),
    ...extra,
  }));
}
