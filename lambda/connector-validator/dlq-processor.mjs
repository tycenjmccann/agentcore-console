import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

// ─── Config ────────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const VALIDATION_TABLE = process.env.VALIDATION_TABLE || "connector-validations";
const VALIDATION_QUEUE_URL = process.env.VALIDATION_QUEUE_URL;
const DLQ_URL = process.env.DLQ_URL;
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN;

const MAX_MESSAGES = 10;

const TRANSIENT_PATTERNS = [
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ThrottlingException",
  "TooManyRequestsException",
  "ServiceUnavailableException",
  "NetworkError",
];

const TRANSIENT_STATUS_CODES = [429, 503, 502, 504];

// ─── Clients ───────────────────────────────────────────────────────────────────

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sqs = new SQSClient({ region: REGION });
const sns = new SNSClient({ region: REGION });

// ─── Handler ───────────────────────────────────────────────────────────────────

export const handler = async () => {
  log("info", "DLQ processor invoked, polling for messages");

  const { Messages: messages } = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: DLQ_URL,
    MaxNumberOfMessages: MAX_MESSAGES,
    WaitTimeSeconds: 5,
    MessageAttributeNames: ["All"],
  }));

  if (!messages || messages.length === 0) {
    log("info", "No messages in DLQ");
    return { statusCode: 200, processed: 0 };
  }

  log("info", "Received DLQ messages", { count: messages.length });

  let redriven = 0;
  let permanent = 0;

  for (const message of messages) {
    try {
      const body = JSON.parse(message.Body);
      const failureReason = extractFailureReason(message, body);
      const isTransient = classifyFailure(failureReason);

      if (isTransient) {
        await redriveMessage(message, body, failureReason);
        redriven++;
      } else {
        await handlePermanentFailure(message, body, failureReason);
        permanent++;
      }
    } catch (err) {
      log("error", "Failed to process DLQ message", {
        messageId: message.MessageId,
        error: err.message,
        stack: err.stack,
      });
    }
  }

  log("info", "DLQ processing complete", { redriven, permanent, total: messages.length });
  return { statusCode: 200, processed: messages.length, redriven, permanent };
};

// ─── Failure Classification ────────────────────────────────────────────────────

function extractFailureReason(message, body) {
  if (body.failureReason) return body.failureReason;

  const attributes = message.MessageAttributes || {};
  if (attributes.ErrorMessage?.StringValue) return attributes.ErrorMessage.StringValue;

  if (body.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);

  return "unknown";
}

function classifyFailure(reason) {
  const reasonUpper = reason.toUpperCase();

  for (const pattern of TRANSIENT_PATTERNS) {
    if (reasonUpper.includes(pattern.toUpperCase())) return true;
  }

  for (const code of TRANSIENT_STATUS_CODES) {
    if (reason.includes(String(code))) return true;
  }

  if (reasonUpper.includes("TIMEOUT") || reasonUpper.includes("TIMED OUT")) return true;
  if (reasonUpper.includes("CONNECTION REFUSED")) return true;

  return false;
}

// ─── Re-drive Transient Failures ───────────────────────────────────────────────

async function redriveMessage(message, body, failureReason) {
  log("info", "Re-driving transient failure", {
    validationId: body.validationId,
    connectorId: body.connectorId,
    failureReason,
  });

  await sqs.send(new SendMessageCommand({
    QueueUrl: VALIDATION_QUEUE_URL,
    MessageBody: message.Body,
    MessageAttributes: message.MessageAttributes,
  }));

  await sqs.send(new DeleteMessageCommand({
    QueueUrl: DLQ_URL,
    ReceiptHandle: message.ReceiptHandle,
  }));
}

// ─── Handle Permanent Failures ─────────────────────────────────────────────────

async function handlePermanentFailure(message, body, failureReason) {
  const { validationId, connectorId, connectorType } = body;

  log("info", "Permanent failure detected, alerting", {
    validationId,
    connectorId,
    failureReason,
  });

  if (validationId) {
    await ddb.send(new UpdateCommand({
      TableName: VALIDATION_TABLE,
      Key: { validationId },
      UpdateExpression: "SET #status = :status, #failureReason = :reason, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#failureReason": "failureReason",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":status": "permanently_failed",
        ":reason": failureReason,
        ":updatedAt": new Date().toISOString(),
      },
    }));
  }

  if (ALERT_TOPIC_ARN) {
    await sns.send(new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: `Connector Validation Permanent Failure: ${connectorId || "unknown"}`,
      Message: JSON.stringify({
        validationId,
        connectorId,
        connectorType,
        failureReason,
        timestamp: new Date().toISOString(),
        messageId: message.MessageId,
      }, null, 2),
    }));
  }

  await sqs.send(new DeleteMessageCommand({
    QueueUrl: DLQ_URL,
    ReceiptHandle: message.ReceiptHandle,
  }));
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function log(level, message, extra = {}) {
  console.log(JSON.stringify({
    level,
    message,
    service: "dlq-processor",
    timestamp: new Date().toISOString(),
    ...extra,
  }));
}
