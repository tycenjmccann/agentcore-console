/**
 * POST /api/workflow/[id]/cancel
 *
 * Cancels an active workflow and all its non-done tickets.
 * Supports both DynamoDB and Jira ticket providers.
 *
 * - 200: Successfully cancelled
 * - 404: Workflow not found
 * - 409: Workflow already in terminal state
 * - 500: Internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";
const TICKET_PROVIDER = process.env.TICKET_PROVIDER || "dynamodb";

const TERMINAL_PHASES = ["complete", "error", "cancelled"] as const;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

// ─── Jira helpers ───────────────────────────────────────────────────────────

function getJiraAuth() {
  const siteUrl = process.env.JIRA_SITE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  if (!siteUrl || !email || !apiToken || !projectKey) return null;
  return {
    baseUrl: `https://${siteUrl}`,
    authHeader: `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
    projectKey,
  };
}

async function jiraRequest(method: string, path: string, body?: unknown) {
  const auth = getJiraAuth();
  if (!auth) throw new Error("Jira not configured");
  const url = `${auth.baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: auth.authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// ─── Cancel tickets via DynamoDB ────────────────────────────────────────────

async function cancelTicketsDynamoDB(workflowId: string): Promise<{ cancelled: number; skipped: number; failed: number }> {
  // Query all tickets for this workflow
  const result = await ddb.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: "workflowId = :wid",
    ExpressionAttributeValues: { ":wid": workflowId },
  }));

  const tickets = (result.Items || []).filter(t => t.ticketId !== "__COUNTER__");
  let cancelled = 0, skipped = 0, failed = 0;

  // Filter out already-done tickets
  const toCancel = tickets.filter(t => t.status !== "done");
  skipped = tickets.length - toCancel.length;

  // Cancel in parallel batches of 10
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
      if (r.status === "fulfilled") cancelled++;
      else if ((r.reason as { name?: string })?.name === "ConditionalCheckFailedException") skipped++;
      else failed++;
    }
  }

  return { cancelled, skipped, failed };
}

// ─── Cancel tickets via Jira ────────────────────────────────────────────────

async function cancelTicketsJira(epicId: string): Promise<{ cancelled: number; skipped: number; failed: number }> {
  const auth = getJiraAuth();
  if (!auth) return { cancelled: 0, skipped: 0, failed: 0 };

  // Search for non-done child tickets
  const jql = encodeURIComponent(`parent = ${epicId} AND status != Done`);
  const data = await jiraRequest(
    "GET",
    `/rest/api/3/search/jql?jql=${jql}&fields=status&maxResults=100`
  ) as { issues?: Array<Record<string, unknown>> };

  const issues = data.issues || [];
  let cancelled = 0, failed = 0;

  // Cancel in parallel batches of 5 (Jira rate limit friendly)
  const batchSize = 5;
  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (issue: Record<string, unknown>) => {
        const issueKey = issue.key as string;
        const transData = await jiraRequest("GET", `/rest/api/3/issue/${issueKey}/transitions`) as {
          transitions?: Array<{ id: string; name: string; to?: { name?: string; statusCategory?: { key?: string } } }>
        };
        const transitions = transData.transitions || [];

        // Find a cancel/won't-do transition
        const cancelTrans = transitions.find(t =>
          t.name === "Won't Do" || t.name === "Cancelled" || t.name === "Cancel" ||
          t.to?.name === "Won't Do" || t.to?.name === "Cancelled"
        );

        if (cancelTrans) {
          await jiraRequest("POST", `/rest/api/3/issue/${issueKey}/transitions`, {
            transition: { id: cancelTrans.id },
          });
          return;
        }

        // Fallback: look for any "Done" category transition with Won't Do resolution
        const doneTrans = transitions.find(t =>
          t.to?.statusCategory?.key === "done"
        );
        if (doneTrans) {
          await jiraRequest("POST", `/rest/api/3/issue/${issueKey}/transitions`, {
            transition: { id: doneTrans.id },
            fields: { resolution: { name: "Won't Do" } },
          });
          return;
        }

        throw new Error(`No cancel transition for ${issueKey}`);
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") cancelled++;
      else failed++;
    }
  }

  return { cancelled, skipped: 0, failed };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  try {
    // 1. Read workflow from DynamoDB
    const wfResult = await ddb.send(new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflowId },
      ConsistentRead: true,
    }));

    if (!wfResult.Item) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const workflow = wfResult.Item;

    // 2. Validate workflow is not already in terminal state
    if (TERMINAL_PHASES.includes(workflow.phase as typeof TERMINAL_PHASES[number])) {
      return NextResponse.json(
        { error: "Workflow already in terminal state", phase: workflow.phase },
        { status: 409 }
      );
    }

    // 3. Conditional write — set phase to "cancelled" (atomic guard against races)
    const cancelledAt = new Date().toISOString();
    try {
      await ddb.send(new UpdateCommand({
        TableName: WORKFLOWS_TABLE,
        Key: { workflowId },
        UpdateExpression: "SET #phase = :cancelled, cancelledAt = :ts, previousPhase = :prev",
        ConditionExpression: "#phase <> :complete AND #phase <> :error AND #phase <> :alreadyCancelled",
        ExpressionAttributeNames: { "#phase": "phase" },
        ExpressionAttributeValues: {
          ":cancelled": "cancelled",
          ":ts": cancelledAt,
          ":prev": workflow.phase,
          ":complete": "complete",
          ":error": "error",
          ":alreadyCancelled": "cancelled",
        },
      }));
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
        return NextResponse.json(
          { error: "Workflow already in terminal state", phase: workflow.phase },
          { status: 409 }
        );
      }
      throw err;
    }

    // 4. Cancel non-done tickets (best-effort)
    let ticketResults = { cancelled: 0, skipped: 0, failed: 0 };
    if (TICKET_PROVIDER === "jira") {
      ticketResults = await cancelTicketsJira(workflow.epicId as string);
    } else {
      ticketResults = await cancelTicketsDynamoDB(workflowId);
    }

    // 5. Publish workflow.cancelled event
    try {
      await ddb.send(new PutCommand({
        TableName: EVENTS_TABLE,
        Item: {
          workflowId,
          eventId: `${Date.now()}-cancel-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: cancelledAt,
          type: "workflow.cancelled",
          detail: {
            workflowId,
            cancelledAt,
            previousPhase: workflow.phase,
            ticketsCancelled: ticketResults.cancelled,
            ticketsSkipped: ticketResults.skipped,
            ticketsFailed: ticketResults.failed,
          },
        },
      }));
    } catch {
      // Event publish is non-fatal — log but don't fail the cancel
      console.warn(`[cancel] Failed to publish workflow.cancelled event for ${workflowId}`);
    }

    console.log(`[cancel] Workflow ${workflowId} cancelled (was: ${workflow.phase}). Tickets: ${ticketResults.cancelled} cancelled, ${ticketResults.skipped} skipped, ${ticketResults.failed} failed`);

    return NextResponse.json({ status: "cancelled", cancelledAt }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cancel] Error cancelling workflow ${workflowId}:`, message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
