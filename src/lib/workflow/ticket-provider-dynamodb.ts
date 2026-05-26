/**
 * DynamoDB Ticket Provider
 *
 * Implements the TicketProvider interface using DynamoDB as the backing store.
 * The same table (agentis-tickets) is used by the orchestrator Lambda and the
 * Next.js API layer.
 *
 * Also exports cancelWorkflowTickets for the cancel workflow feature.
 */

import type { TicketProvider, CreateEpicInput, CreateTicketInput } from "./ticket-provider";
import type { JiraTicket, JiraComment, Artifact, TicketStatus } from "./types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export interface CancelTicketsResult {
  cancelled: number;
  skipped: number;
  failed: number;
}

/**
 * Cancel all non-done tickets under an epic.
 * Uses conditional writes to avoid overwriting completed tickets.
 */
export async function cancelWorkflowTickets(epicId: string): Promise<CancelTicketsResult> {
  // 1. Query all tickets for this epic
  const result = await ddb.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    IndexName: "parentId-index",
    KeyConditionExpression: "parentId = :pid",
    ExpressionAttributeValues: { ":pid": epicId },
  }));

  const tickets = result.Items || [];
  let cancelled = 0;
  let skipped = 0;
  let failed = 0;

  // 2. Filter: skip tickets already done
  const toCancel = tickets.filter(t => t.status !== "done");
  skipped = tickets.length - toCancel.length;

  // 3. Cancel in batches with concurrency control
  const batchSize = 10;
  for (let i = 0; i < toCancel.length; i += batchSize) {
    const batch = toCancel.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(ticket =>
        ddb.send(new UpdateCommand({
          TableName: TICKETS_TABLE,
          Key: { ticketId: ticket.ticketId },
          UpdateExpression: "SET #s = :cancelled, cancelledAt = :ts, #u = :u",
          ConditionExpression: "#s <> :done",
          ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
          ExpressionAttributeValues: {
            ":cancelled": "cancelled",
            ":done": "done",
            ":ts": new Date().toISOString(),
            ":u": new Date().toISOString(),
          },
        }))
      )
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        cancelled++;
      } else if ((r.reason as { name?: string })?.name === "ConditionalCheckFailedException") {
        skipped++;
      } else {
        failed++;
        console.warn(`[cancel] Failed to cancel ticket:`, r.reason);
      }
    }
  }

  return { cancelled, skipped, failed };
}

// DynamoDBProvider class implementing TicketProvider interface
export class DynamoDBProvider implements TicketProvider {
  async createEpic(input: CreateEpicInput): Promise<JiraTicket> {
    const ticketId = await this.nextTicketId();
    const now = new Date().toISOString();
    const item = {
      ticketId,
      type: "epic" as const,
      title: input.title,
      description: input.description,
      status: "todo" as TicketStatus,
      children: [],
      blockedBy: [],
      comments: [],
      artifacts: [],
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({ TableName: TICKETS_TABLE, Item: item }));
    return this.itemToTicket(item);
  }

  async createTicket(input: CreateTicketInput, workflowId?: string): Promise<JiraTicket> {
    const ticketId = await this.nextTicketId();
    const now = new Date().toISOString();
    const status: TicketStatus = (input.blockedBy && input.blockedBy.length > 0) ? "blocked" : "todo";
    const item = {
      ticketId,
      type: "task" as const,
      title: input.title,
      description: input.description,
      status,
      assignee: input.assignee,
      parentId: input.parentId,
      workflowId,
      blockedBy: input.blockedBy || [],
      children: [],
      comments: [],
      artifacts: [],
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({ TableName: TICKETS_TABLE, Item: item }));
    return this.itemToTicket(item);
  }

  async markDone(ticketId: string, _workflowId: string): Promise<string[]> {
    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: "SET #s = :done, #u = :u",
      ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
      ExpressionAttributeValues: { ":done": "done", ":u": new Date().toISOString() },
    }));
    return []; // DDB stream handles unblocking via orchestrator
  }

  async markInProgress(ticketId: string, _workflowId: string): Promise<void> {
    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: "SET #s = :s, #u = :u",
      ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
      ExpressionAttributeValues: { ":s": "in_progress", ":u": new Date().toISOString() },
    }));
  }

  async markBlocked(ticketId: string, reason: string, _workflowId: string): Promise<void> {
    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: "SET #s = :s, #u = :u",
      ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
      ExpressionAttributeValues: { ":s": "blocked", ":u": new Date().toISOString() },
    }));
  }

  async addArtifact(ticketId: string, artifact: Omit<Artifact, "id" | "timestamp">): Promise<Artifact> {
    const id = `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const fullArtifact: Artifact = { ...artifact, id, timestamp };

    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: "SET artifacts = list_append(if_not_exists(artifacts, :empty), :art), #u = :u",
      ExpressionAttributeNames: { "#u": "updatedAt" },
      ExpressionAttributeValues: {
        ":art": [fullArtifact],
        ":empty": [],
        ":u": timestamp,
      },
    }));

    return fullArtifact;
  }

  async addComment(ticketId: string, author: string, content: string): Promise<JiraComment> {
    const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const comment: JiraComment = { id, author, content, timestamp };

    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: "SET comments = list_append(if_not_exists(comments, :empty), :cmt), #u = :u",
      ExpressionAttributeNames: { "#u": "updatedAt" },
      ExpressionAttributeValues: {
        ":cmt": [comment],
        ":empty": [],
        ":u": timestamp,
      },
    }));

    return comment;
  }

  async isWorkflowComplete(epicId: string): Promise<boolean> {
    const result = await ddb.send(new QueryCommand({
      TableName: TICKETS_TABLE,
      IndexName: "parentId-index",
      KeyConditionExpression: "parentId = :pid",
      ExpressionAttributeValues: { ":pid": epicId },
    }));
    const tickets = result.Items || [];
    if (tickets.length === 0) return false;
    return tickets.every(t => t.status === "done");
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private async nextTicketId(): Promise<string> {
    const projectKey = process.env.PROJECT_KEY || "TEAM";
    const result = await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId: "__COUNTER__" },
      UpdateExpression: "SET #n = if_not_exists(#n, :zero) + :one",
      ExpressionAttributeNames: { "#n": "nextNum" },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
      ReturnValues: "UPDATED_NEW",
    }));
    return `${projectKey}-${result.Attributes!.nextNum}`;
  }

  private itemToTicket(item: Record<string, unknown>): JiraTicket {
    return {
      id: item.ticketId as string,
      type: (item.type as JiraTicket["type"]) || "task",
      title: (item.title as string) || "",
      description: (item.description as string) || "",
      status: (item.status as TicketStatus) || "todo",
      assignee: item.assignee as string | undefined,
      parent: item.parentId as string | undefined,
      children: (item.children as string[]) || [],
      blockedBy: (item.blockedBy as string[]) || [],
      comments: (item.comments as JiraComment[]) || [],
      artifacts: (item.artifacts as Artifact[]) || [],
      createdAt: (item.createdAt as string) || new Date().toISOString(),
      updatedAt: (item.updatedAt as string) || new Date().toISOString(),
    };
  }
}
