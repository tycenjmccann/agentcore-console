/**
 * Ticket Skeleton Creator — Minimal Version
 *
 * Creates only the epic and the requirements ticket.
 * The requirements agent is responsible for creating all downstream tickets
 * based on its analysis of the feature scope.
 *
 * Flow:
 * 1. Epic created (container for all tickets)
 * 2. Requirements ticket created with status="todo" (no blockers → Stream fires → Lambda invokes)
 * 3. Requirements agent analyzes scope, creates design/dev/QA/CI tickets as needed
 * 4. DynamoDB Stream handles all cascading from there
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const PROJECT_KEY = process.env.PROJECT_KEY || "TEAM";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

interface SkeletonResult {
  epicId: string;
  requirementsTicketId: string;
  ticketIds: Record<string, string>; // agentId → ticketId
}

/**
 * Create the epic and requirements ticket for a workflow.
 * The requirements agent will create all other tickets.
 */
export async function createTicketSkeletons(
  workflowId: string,
  title: string,
  description: string
): Promise<SkeletonResult> {
  const ticketIds: Record<string, string> = {};

  // Create epic
  const epicId = await nextTicketId();
  await ddb.send(new PutCommand({
    TableName: TICKETS_TABLE,
    Item: {
      ticketId: epicId,
      type: "epic",
      title,
      description,
      status: "in_progress",
      workflowId,
      comments: [],
      artifacts: [],
      blockedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));

  // Create requirements ticket (status=todo → Stream fires → Lambda invokes immediately)
  const reqTicketId = await nextTicketId();
  ticketIds["team-requirements-analyst"] = reqTicketId;
  await ddb.send(new PutCommand({
    TableName: TICKETS_TABLE,
    Item: {
      ticketId: reqTicketId,
      type: "task",
      title: `Requirements Analysis: ${title}`,
      description: `Analyze the feature request and create tickets for the relevant agents.\n\n## Feature Request\n${description}`,
      status: "todo",
      assignee: "team-requirements-analyst",
      parentId: epicId,
      workflowId,
      comments: [],
      artifacts: [],
      blockedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));

  console.log(`[skeletons] Created epic ${epicId} + requirements ticket ${reqTicketId} for workflow ${workflowId}`);

  return { epicId, requirementsTicketId: reqTicketId, ticketIds };
}

async function nextTicketId(): Promise<string> {
  const result = await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId: "__COUNTER__" },
    UpdateExpression: "SET #n = if_not_exists(#n, :zero) + :one",
    ExpressionAttributeNames: { "#n": "nextNum" },
    ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    ReturnValues: "UPDATED_NEW",
  }));
  return `${PROJECT_KEY}-${result.Attributes!.nextNum}`;
}
