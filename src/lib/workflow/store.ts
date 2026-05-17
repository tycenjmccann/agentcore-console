/**
 * In-memory stores for workflow state, tickets, and SSE subscribers.
 * Now with S3-backed persistence — state is saved on each mutation and
 * rehydrated on server start (or first access after restart).
 */

import type {
  WorkflowState,
  JiraTicket,
  WorkflowEvent,
} from "./types";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { syncTicketCounter } from "./jira-mock";

const S3_BUCKET = process.env.TEAM_WORKFLOW_S3_BUCKET || "";
const S3_STATE_PREFIX = "workflow-state/";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

// ─── Stores ──────────────────────────────────────────────────────────────────

const workflows = new Map<string, WorkflowState>();
const tickets = new Map<string, JiraTicket>();

// SSE subscribers per workflow
type SSEController = ReadableStreamDefaultController<Uint8Array>;
const subscribers = new Map<string, Set<SSEController>>();

// Track whether we've rehydrated from S3
let rehydrated = false;
let rehydratePromise: Promise<void> | null = null;

// ─── Workflow CRUD ───────────────────────────────────────────────────────────

export function getWorkflow(id: string): WorkflowState | undefined {
  return workflows.get(id);
}

// Simple throttle — persist at most once per 2 seconds per workflow
const lastPersistTime = new Map<string, number>();

export function setWorkflow(state: WorkflowState): void {
  workflows.set(state.id, state);

  const now = Date.now();
  const last = lastPersistTime.get(state.id) || 0;

  // Persist immediately on phase changes; throttle for rapid updates
  const isSignificant = state.phase === "complete" || state.phase === "error" ||
    state.phase === "design" || state.phase === "development" || state.phase === "requirements";

  if (isSignificant || now - last > 2000) {
    lastPersistTime.set(state.id, now);
    // For terminal states, await the persist to guarantee it lands
    if (state.phase === "complete" || state.phase === "error") {
      persistWorkflowSync(state.id);
    } else {
      persistWorkflow(state.id);
    }
  }
}

export function listWorkflows(): WorkflowState[] {
  return Array.from(workflows.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function deleteWorkflow(id: string): boolean {
  const wf = workflows.get(id);
  if (!wf) return false;
  workflows.delete(id);
  // Remove all associated tickets (epic + all descendants)
  const toDelete = new Set<string>([wf.epicId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [ticketId, ticket] of tickets.entries()) {
      if (!toDelete.has(ticketId) && ticket.parent && toDelete.has(ticket.parent)) {
        toDelete.add(ticketId);
        changed = true;
      }
    }
  }
  for (const tid of toDelete) {
    tickets.delete(tid);
  }
  return true;
}

// ─── Ticket CRUD ─────────────────────────────────────────────────────────────

export function getTicket(id: string): JiraTicket | undefined {
  return tickets.get(id);
}

export function setTicket(ticket: JiraTicket): void {
  tickets.set(ticket.id, ticket);
}

export function getTicketsForWorkflow(epicId: string): JiraTicket[] {
  const epic = tickets.get(epicId);
  if (!epic) return [];

  const result: JiraTicket[] = [epic];
  const collectChildren = (parentId: string) => {
    for (const ticket of tickets.values()) {
      if (ticket.parent === parentId) {
        result.push(ticket);
        collectChildren(ticket.id);
      }
    }
  };
  collectChildren(epicId);
  return result;
}

export function getReadyTickets(epicId: string): JiraTicket[] {
  return getTicketsForWorkflow(epicId).filter((t) => t.status === "ready");
}

export function getAllTickets(): JiraTicket[] {
  return Array.from(tickets.values());
}

// ─── Reverse Lookups ────────────────────────────────────────────────────────

/**
 * Find the workflow that owns a given ticket.
 * Searches agent tasks and the epic ID across all active workflows.
 */
export function findWorkflowByTicket(ticketId: string): WorkflowState | undefined {
  for (const wf of workflows.values()) {
    if (wf.epicId === ticketId) return wf;
    for (const task of Object.values(wf.agentTasks)) {
      if (task.ticketId === ticketId) return wf;
    }
  }
  // Also check all tickets to find the epic → workflow
  const ticket = getTicket(ticketId);
  if (ticket?.parent) {
    for (const wf of workflows.values()) {
      if (wf.epicId === ticket.parent) return wf;
    }
  }
  return undefined;
}

/**
 * Find a workflow's agent task by agent ID.
 */
export function findTaskByAgent(workflowId: string, agentId: string) {
  const wf = workflows.get(workflowId);
  return wf?.agentTasks[agentId];
}

// ─── SSE Subscriber Management ───────────────────────────────────────────────

export function addSubscriber(workflowId: string, controller: SSEController): void {
  let subs = subscribers.get(workflowId);
  if (!subs) {
    subs = new Set();
    subscribers.set(workflowId, subs);
  }
  subs.add(controller);
}

export function removeSubscriber(workflowId: string, controller: SSEController): void {
  const subs = subscribers.get(workflowId);
  if (subs) {
    subs.delete(controller);
    if (subs.size === 0) subscribers.delete(workflowId);
  }
}

/**
 * Emit an SSE event to all subscribers of a workflow.
 */
export function emitEvent(workflowId: string, event: WorkflowEvent): void {
  const subs = subscribers.get(workflowId);
  if (!subs || subs.size === 0) return;

  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = encoder.encode(data);

  for (const controller of subs) {
    try {
      controller.enqueue(encoded);
    } catch {
      // Controller closed — remove it
      subs.delete(controller);
    }
  }
}

/**
 * Get subscriber count for a workflow (useful for diagnostics).
 */
export function subscriberCount(workflowId: string): number {
  return subscribers.get(workflowId)?.size ?? 0;
}

// ─── S3 Persistence ─────────────────────────────────────────────────────────

/**
 * Persist for terminal states — adds a 500ms delay to ensure it overwrites
 * any in-flight persists from the immediately preceding state change.
 */
function persistWorkflowSync(workflowId: string): void {
  // Small delay ensures this write happens AFTER any concurrent fire-and-forget persists
  setTimeout(() => {
    const wf = workflows.get(workflowId);
    if (!wf) return;
    const epicTicket = tickets.get(wf.epicId);
    const wfTickets: JiraTicket[] = [];
    if (epicTicket) {
      wfTickets.push(epicTicket);
      const collect = (parentId: string) => {
        for (const t of tickets.values()) {
          if (t.parent === parentId) { wfTickets.push(t); collect(t.id); }
        }
      };
      collect(epicTicket.id);
    }
    const payload = JSON.stringify({ workflow: wf, tickets: wfTickets }, null, 2);
    const key = `${S3_STATE_PREFIX}${workflowId}.json`;
    s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: payload,
      ContentType: "application/json",
    })).then(() => {
      console.log(`[store] FINAL persist ${workflowId} phase=${wf.phase} (${Math.round(payload.length / 1024)}KB)`);
    }).catch((err) => {
      console.error(`[store] FINAL persist FAILED ${workflowId}:`, err.message);
    });
  }, 500);
}

/**
 * Save workflow state + its tickets to S3. Called after significant mutations.
 * Fire-and-forget — failures don't block the workflow.
 */
export function persistWorkflow(workflowId: string): void {
  const wf = workflows.get(workflowId);
  if (!wf) return;

  // Gather tickets for this workflow
  const epicTicket = tickets.get(wf.epicId);
  const wfTickets: JiraTicket[] = [];
  if (epicTicket) {
    wfTickets.push(epicTicket);
    const collect = (parentId: string) => {
      for (const t of tickets.values()) {
        if (t.parent === parentId) {
          wfTickets.push(t);
          collect(t.id);
        }
      }
    };
    collect(epicTicket.id);
  }

  const payload = JSON.stringify({ workflow: wf, tickets: wfTickets }, null, 2);
  const key = `${S3_STATE_PREFIX}${workflowId}.json`;

  s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: payload,
    ContentType: "application/json",
  })).then(() => {
    console.log(`[store] Persisted workflow ${workflowId} (${Math.round(payload.length / 1024)}KB)`);
  }).catch((err) => {
    console.error(`[store] FAILED to persist workflow ${workflowId}:`, err.message);
  });
}

/**
 * Rehydrate all workflows from S3. Called once on first access after restart.
 */
async function rehydrateFromS3(): Promise<void> {
  if (rehydrated) return;
  if (rehydratePromise) return rehydratePromise;

  rehydratePromise = (async () => {
    try {
      const listRes = await s3.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: S3_STATE_PREFIX,
        MaxKeys: 50,
      }));

      const keys = (listRes.Contents || [])
        .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
        .slice(0, 20) // Last 20 workflows
        .map((o) => o.Key!)
        .filter(Boolean);

      for (const key of keys) {
        try {
          const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
          const body = await res.Body?.transformToString();
          if (!body) continue;

          const { workflow, tickets: wfTickets } = JSON.parse(body) as {
            workflow: WorkflowState;
            tickets: JiraTicket[];
          };

          if (workflow && !workflows.has(workflow.id)) {
            workflows.set(workflow.id, workflow);
          }
          if (wfTickets) {
            for (const t of wfTickets) {
              if (!tickets.has(t.id)) {
                tickets.set(t.id, t);
              }
            }
          }
        } catch {
          // Skip corrupted entries
        }
      }
      // Sync ticket counter to avoid ID collisions
      const allTicketIds = Array.from(tickets.keys());
      if (allTicketIds.length > 0) {
        syncTicketCounter(allTicketIds);
        console.log(`[store] Synced ticket counter past ${allTicketIds.length} existing tickets`);
      }
    } catch (err) {
      console.warn("[store] Rehydration from S3 failed:", (err as Error).message);
    } finally {
      rehydrated = true;
      rehydratePromise = null;
    }
  })();

  return rehydratePromise;
}

/**
 * Ensure store is rehydrated before reading. Call before list operations.
 */
export async function ensureRehydrated(): Promise<void> {
  if (!rehydrated) {
    await rehydrateFromS3();
  }
}
