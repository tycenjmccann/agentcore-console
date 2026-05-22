/**
 * Mock Jira System — Ticket-Driven Orchestration
 *
 * The ticket system IS the orchestration layer.
 * Status transitions trigger agent invocations:
 *   - When a ticket's blockers are all "done" → auto-flip to "ready"
 *   - Engine watches for "ready" tickets → invokes assigned agent
 *   - Agent marks ticket "done" → downstream tickets may unblock
 */

import type {
  JiraTicket,
  JiraComment,
  Artifact,
  TicketType,
  TicketStatus,
} from "./types";
import { getTicket, setTicket, emitEvent, getTicketsForWorkflow } from "./store";

// Auto-increment counter for ticket IDs (survives HMR via globalThis)
const gm = globalThis as typeof globalThis & { __ticketCounter?: number };
if (gm.__ticketCounter === undefined) gm.__ticketCounter = 0;

function nextTicketId(): string {
  gm.__ticketCounter = (gm.__ticketCounter || 0) + 1;
  return `TEAM-${gm.__ticketCounter}`;
}

// Expose for external reads
function getTicketCounter(): number { return gm.__ticketCounter || 0; }

/**
 * Reset counter (useful for tests).
 */
export function resetTicketCounter(): void {
  gm.__ticketCounter = 0;
}

/**
 * Initialize the counter to be above the highest existing ticket ID.
 * Called after rehydration to prevent ID collisions.
 */
export function syncTicketCounter(existingIds: string[]): void {
  let max = gm.__ticketCounter || 0;
  for (const id of existingIds) {
    const match = id.match(/^TEAM-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  gm.__ticketCounter = max;
}

// ─── Ticket Creation ─────────────────────────────────────────────────────────

export interface CreateEpicInput {
  title: string;
  description: string;
}

export function createEpic(input: CreateEpicInput): JiraTicket {
  const ticket: JiraTicket = {
    id: nextTicketId(),
    type: "epic",
    title: input.title,
    description: input.description,
    status: "ready",
    children: [],
    blockedBy: [],
    comments: [],
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  setTicket(ticket);
  return ticket;
}

export interface CreateTicketInput {
  parentId: string;
  type?: TicketType;
  title: string;
  description: string;
  assignee: string;              // agent ID
  blockedBy?: string[];          // ticket IDs that must complete first
}

export function createTicket(input: CreateTicketInput, workflowId?: string): JiraTicket {
  const id = nextTicketId();

  // Determine initial status: "ready" if no blockers, "todo" if blocked
  const blockers = input.blockedBy ?? [];
  const allBlockersDone = blockers.length === 0 || blockers.every((bid) => {
    const blocker = getTicket(bid);
    return blocker?.status === "done";
  });

  const ticket: JiraTicket = {
    id,
    type: input.type ?? "story",
    title: input.title,
    description: input.description,
    status: allBlockersDone ? "ready" : "todo",
    assignee: input.assignee,
    parent: input.parentId,
    children: [],
    blockedBy: blockers,
    comments: [],
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  setTicket(ticket);

  // Add to parent's children list
  const parent = getTicket(input.parentId);
  if (parent) {
    parent.children.push(id);
    parent.updatedAt = new Date().toISOString();
    setTicket(parent);
  }

  // Emit event
  if (workflowId) {
    emitEvent(workflowId, { type: "ticket_created", ticket });
  }

  return ticket;
}

// ─── Status Transitions ──────────────────────────────────────────────────────

/**
 * Mark a ticket as done. This is the key orchestration trigger:
 * checks all tickets that list this one as a blocker, and auto-flips
 * them to "ready" if all their blockers are now done.
 *
 * Returns list of ticket IDs that were newly unblocked (flipped to "ready").
 */
export function markDone(ticketId: string, workflowId: string): string[] {
  const ticket = getTicket(ticketId);
  if (!ticket) return [];

  ticket.status = "done";
  ticket.updatedAt = new Date().toISOString();
  setTicket(ticket);

  emitEvent(workflowId, { type: "ticket_update", ticketId, status: "done" });

  // Find the epic to get all workflow tickets
  const epicId = findEpicId(ticket);
  if (!epicId) return [];

  // Check downstream tickets that had this as a blocker
  const allTickets = getTicketsForWorkflow(epicId);
  const newlyReady: string[] = [];

  for (const t of allTickets) {
    if (t.status !== "todo") continue;
    if (!t.blockedBy.includes(ticketId)) continue;

    // Check if ALL blockers for this ticket are now done
    const allBlockersDone = t.blockedBy.every((bid) => {
      const blocker = getTicket(bid);
      return blocker?.status === "done";
    });

    if (allBlockersDone) {
      t.status = "ready";
      t.updatedAt = new Date().toISOString();
      setTicket(t);
      newlyReady.push(t.id);
      emitEvent(workflowId, { type: "ticket_update", ticketId: t.id, status: "ready" });
    }
  }

  return newlyReady;
}

/**
 * Mark a ticket as in-progress (agent has picked it up).
 */
export function markInProgress(ticketId: string, workflowId: string): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;

  ticket.status = "in_progress";
  ticket.updatedAt = new Date().toISOString();
  setTicket(ticket);

  emitEvent(workflowId, { type: "ticket_update", ticketId, status: "in_progress" });
}

/**
 * Mark a ticket as blocked (requires human intervention).
 */
export function markBlocked(ticketId: string, reason: string, workflowId: string): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;

  ticket.status = "blocked";
  ticket.updatedAt = new Date().toISOString();
  setTicket(ticket);

  emitEvent(workflowId, { type: "ticket_update", ticketId, status: "blocked" });
  emitEvent(workflowId, {
    type: "notification",
    notification: {
      id: `notif_${Date.now()}`,
      type: "blocker",
      title: `${ticket.id} blocked: ${ticket.title}`,
      details: reason,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    },
  });
}

// ─── Comments & Artifacts ────────────────────────────────────────────────────

export function addComment(ticketId: string, author: string, content: string): JiraComment {
  const ticket = getTicket(ticketId);
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  const comment: JiraComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    author,
    content,
    timestamp: new Date().toISOString(),
  };

  ticket.comments.push(comment);
  ticket.updatedAt = new Date().toISOString();
  setTicket(ticket);
  return comment;
}

export function addArtifact(ticketId: string, artifact: Omit<Artifact, "id" | "timestamp">): Artifact {
  const ticket = getTicket(ticketId);
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  const full: Artifact = {
    ...artifact,
    id: `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  ticket.artifacts.push(full);
  ticket.updatedAt = new Date().toISOString();
  setTicket(ticket);
  return full;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Walk up the parent chain to find the epic ID.
 */
function findEpicId(ticket: JiraTicket): string | undefined {
  if (ticket.type === "epic") return ticket.id;
  if (!ticket.parent) return undefined;
  const parent = getTicket(ticket.parent);
  if (!parent) return undefined;
  return findEpicId(parent);
}

/**
 * Check if all tickets in a workflow are "done".
 */
export function isWorkflowComplete(epicId: string): boolean {
  const allTickets = getTicketsForWorkflow(epicId);
  return allTickets.every((t) => t.status === "done");
}
