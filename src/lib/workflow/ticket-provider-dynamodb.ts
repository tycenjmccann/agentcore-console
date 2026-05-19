/**
 * DynamoDB Ticket Provider
 *
 * Reads/writes tickets from the same DynamoDB table as the mock Jira Lambda.
 * This creates a single source of truth:
 *   - Agents create tickets via JiraIntegration___create_ticket (Lambda → DynamoDB)
 *   - Engine observes and manages tickets via this provider (also DynamoDB)
 *
 * Both sides see the same data. No S3 intermediary. No parsing fallback.
 *
 * Set TICKET_PROVIDER=dynamodb to use this provider.
 * Requires JIRA_TABLE_NAME env var (defaults to "agentis-tickets").
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { TicketProvider, CreateEpicInput, CreateTicketInput } from "./ticket-provider";
import type { JiraTicket, JiraComment, Artifact, TicketStatus, TicketType } from "./types";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const PROJECT_KEY = process.env.PROJECT_KEY || "TEAM";
const COUNTER_KEY = { ticketId: "__COUNTER__" };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Map DynamoDB item → internal JiraTicket format.
 */
function toJiraTicket(item: Record<string, unknown>): JiraTicket {
  return {
    id: item.ticketId as string,
    type: ((item.type as string) === "epic" ? "epic" : "task") as TicketType,
    title: (item.title as string) || "",
    description: (item.description as string) || "",
    status: (item.status as TicketStatus) || "todo",
    assignee: (item.assignee as string) || undefined,
    parent: (item.parentId as string) || undefined,
    children: [], // DynamoDB doesn't maintain child list — derived from parentId GSI
    blockedBy: (item.blockedBy as string[]) || [],
    comments: ((item.comments as JiraComment[]) || []),
    artifacts: ((item.artifacts as Artifact[]) || []),
    createdAt: (item.createdAt as string) || new Date().toISOString(),
    updatedAt: (item.updatedAt as string) || new Date().toISOString(),
  };
}

export class DynamoDBProvider implements TicketProvider {
  async createEpic(input: CreateEpicInput): Promise<JiraTicket> {
    const ticketId = await this.nextId();
    const now = new Date().toISOString();

    const item: Record<string, unknown> = {
      ticketId,
      type: "epic",
      title: input.title,
      description: input.description || "",
      status: "todo",
      // Omit null GSI keys — DynamoDB cannot index NULL values
      comments: [],
      artifacts: [],
      blockedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return toJiraTicket(item);
  }

  async createTicket(input: CreateTicketInput, workflowId?: string): Promise<JiraTicket> {
    const ticketId = await this.nextId();
    const now = new Date().toISOString();
    const status: TicketStatus = input.blockedBy && input.blockedBy.length > 0 ? "blocked" : "todo";

    const item: Record<string, unknown> = {
      ticketId,
      type: "task",
      title: input.title,
      description: input.description || "",
      status,
      // Omit null GSI keys — DynamoDB cannot index NULL values
      ...(input.assignee ? { assignee: input.assignee } : {}),
      ...(input.parentId ? { parentId: input.parentId } : {}),
      ...(workflowId ? { workflowId } : {}),
      comments: [],
      artifacts: [],
      blockedBy: input.blockedBy || [],
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return toJiraTicket(item);
  }

  async markDone(ticketId: string, workflowId: string): Promise<string[]> {
    await this.updateStatus(ticketId, "done");

    // Find tickets that were blocked by this one and unblock them
    const children = await this.getTicketsByParent(workflowId);
    const unblocked: string[] = [];

    for (const child of children) {
      if (child.blockedBy?.includes(ticketId)) {
        const remaining = child.blockedBy.filter((id) => id !== ticketId);
        if (remaining.length === 0) {
          // All blockers resolved — mark as ready (todo)
          await ddb.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { ticketId: child.id },
              UpdateExpression: "SET #s = :s, #bb = :bb, #u = :u",
              ExpressionAttributeNames: { "#s": "status", "#bb": "blockedBy", "#u": "updatedAt" },
              ExpressionAttributeValues: { ":s": "todo", ":bb": [], ":u": new Date().toISOString() },
            })
          );
          unblocked.push(child.id);
        } else {
          // Still blocked by others
          await ddb.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { ticketId: child.id },
              UpdateExpression: "SET #bb = :bb, #u = :u",
              ExpressionAttributeNames: { "#bb": "blockedBy", "#u": "updatedAt" },
              ExpressionAttributeValues: { ":bb": remaining, ":u": new Date().toISOString() },
            })
          );
        }
      }
    }

    return unblocked;
  }

  async markInProgress(ticketId: string, _workflowId: string): Promise<void> {
    await this.updateStatus(ticketId, "in_progress");
  }

  async markBlocked(ticketId: string, reason: string, _workflowId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "blocked", ":u": new Date().toISOString() },
      })
    );
    // Also add a comment explaining the block
    await this.addComment(ticketId, "system", `Blocked: ${reason}`);
  }

  async addArtifact(ticketId: string, artifact: Omit<Artifact, "id" | "timestamp">): Promise<Artifact> {
    const full: Artifact = {
      ...artifact,
      id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { ticketId },
        UpdateExpression: "SET #a = list_append(if_not_exists(#a, :empty), :art), #u = :u",
        ExpressionAttributeNames: { "#a": "artifacts", "#u": "updatedAt" },
        ExpressionAttributeValues: {
          ":art": [full],
          ":empty": [],
          ":u": new Date().toISOString(),
        },
      })
    );

    return full;
  }

  async addComment(ticketId: string, author: string, content: string): Promise<JiraComment> {
    const comment: JiraComment = {
      id: `c-${Date.now()}`,
      author,
      content,
      timestamp: new Date().toISOString(),
    };

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { ticketId },
        UpdateExpression: "SET #c = list_append(if_not_exists(#c, :empty), :comment), #u = :u",
        ExpressionAttributeNames: { "#c": "comments", "#u": "updatedAt" },
        ExpressionAttributeValues: {
          ":comment": [comment],
          ":empty": [],
          ":u": new Date().toISOString(),
        },
      })
    );

    return comment;
  }

  async isWorkflowComplete(epicId: string): Promise<boolean> {
    const children = await this.getChildTickets(epicId);
    if (children.length === 0) return false;
    return children.every((t) => t.status === "done");
  }

  // ─── DynamoDB-specific helpers ─────────────────────────────────────────────

  /**
   * Get a ticket by ID directly from DynamoDB.
   */
  async getTicket(ticketId: string): Promise<JiraTicket | null> {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { ticketId } }));
    return result.Item ? toJiraTicket(result.Item) : null;
  }

  /**
   * Get child tickets of an epic.
   */
  async getChildTickets(parentId: string): Promise<JiraTicket[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "parentId-index",
        KeyConditionExpression: "parentId = :pid",
        ExpressionAttributeValues: { ":pid": parentId },
      })
    );
    return (result.Items || []).map(toJiraTicket);
  }

  /**
   * Get all tickets for a workflow by scanning the parent's children.
   * (workflowId is stored on tickets for tracing but parent_id GSI is the primary query path)
   */
  private async getTicketsByParent(epicIdOrWorkflowId: string): Promise<JiraTicket[]> {
    // Try as parent first (most common path)
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "parentId-index",
        KeyConditionExpression: "parentId = :pid",
        ExpressionAttributeValues: { ":pid": epicIdOrWorkflowId },
      })
    );
    return (result.Items || []).map(toJiraTicket);
  }

  /**
   * Get tickets by assignee (used by engine to check agent workload).
   */
  async getTicketsByAssignee(assignee: string): Promise<JiraTicket[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "assignee-index",
        KeyConditionExpression: "assignee = :a",
        ExpressionAttributeValues: { ":a": assignee },
      })
    );
    return (result.Items || []).map(toJiraTicket);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async updateStatus(ticketId: string, status: TicketStatus): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": status, ":u": new Date().toISOString() },
      })
    );
  }

  private async nextId(): Promise<string> {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: COUNTER_KEY,
        UpdateExpression: "SET #n = if_not_exists(#n, :zero) + :one",
        ExpressionAttributeNames: { "#n": "nextNum" },
        ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      })
    );
    return `${PROJECT_KEY}-${result.Attributes!.nextNum}`;
  }
}
