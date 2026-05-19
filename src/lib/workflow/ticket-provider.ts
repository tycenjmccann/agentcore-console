/**
 * Ticket Provider Interface
 *
 * Abstracts the ticket system so the orchestration engine doesn't care
 * whether it's talking to an in-memory mock or real Jira.
 *
 * Switch via env var: TICKET_PROVIDER=jira | memory (default: memory)
 */

import type { JiraTicket, JiraComment, Artifact, TicketStatus } from "./types";

// ─── Interface ──────────────────────────────────────────────────────────────

export interface CreateEpicInput {
  title: string;
  description: string;
}

export interface CreateTicketInput {
  parentId: string;
  title: string;
  description: string;
  assignee: string;
  blockedBy?: string[];
}

export interface TicketProvider {
  /** Create an epic (top-level ticket for the workflow) */
  createEpic(input: CreateEpicInput): JiraTicket | Promise<JiraTicket>;

  /** Create a child ticket (story/task) */
  createTicket(input: CreateTicketInput, workflowId?: string): JiraTicket | Promise<JiraTicket>;

  /** Mark ticket done. Returns IDs of tickets that became "ready" (unblocked). */
  markDone(ticketId: string, workflowId: string): string[] | Promise<string[]>;

  /** Mark ticket in-progress */
  markInProgress(ticketId: string, workflowId: string): void | Promise<void>;

  /** Mark ticket blocked */
  markBlocked(ticketId: string, reason: string, workflowId: string): void | Promise<void>;

  /** Add an artifact to a ticket */
  addArtifact(ticketId: string, artifact: Omit<Artifact, "id" | "timestamp">): Artifact | Promise<Artifact>;

  /** Add a comment to a ticket */
  addComment(ticketId: string, author: string, content: string): JiraComment | Promise<JiraComment>;

  /** Check if all tickets in the workflow are done */
  isWorkflowComplete(epicId: string): boolean | Promise<boolean>;
}

// ─── Provider Selection ─────────────────────────────────────────────────────

let _provider: TicketProvider | null = null;

export function getTicketProvider(): TicketProvider {
  if (_provider) return _provider;

  const providerType = process.env.TICKET_PROVIDER || "memory";

  if (providerType === "dynamodb") {
    // DynamoDB provider — same table as the mock Jira Lambda MCP server.
    // Agents write via Lambda tool calls, engine reads/manages via this provider.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamoDBProvider } = require("./ticket-provider-dynamodb");
    _provider = new DynamoDBProvider() as TicketProvider;
  } else if (providerType === "jira") {
    // Real Jira Cloud provider (stub — swap gateway target for real Jira MCP)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JiraCloudProvider } = require("./ticket-provider-jira");
    _provider = new JiraCloudProvider() as TicketProvider;
  } else {
    // Default: in-memory mock (no external dependencies)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { InMemoryProvider } = require("./ticket-provider-memory");
    _provider = new InMemoryProvider() as TicketProvider;
  }

  console.log(`[tickets] Using provider: ${providerType}`);
  return _provider!;
}

/**
 * Override the provider (for testing or hot-swap).
 */
export function setTicketProvider(provider: TicketProvider): void {
  _provider = provider;
}
