/**
 * POST /api/workflow/[id]/cancel
 *
 * Cancels a running workflow and all its non-done tickets.
 * Supports both DynamoDB and Jira ticket providers — reads the workflow record
 * to determine which provider to use (same dual-provider pattern as retry/nudge).
 *
 * No request body required.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

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

// ─── Cancel tickets via DynamoDB ────────────────────────────────────────────

async function cancelTicketsDynamoDB(epicId: string) {
  const now = new Date().toISOString();
  let cancelled = 0;
  let skipped = 0;
  let failed = 0;

  // Query all tickets under the epic using parentId-index
  const result = await ddb.send(
    new QueryCommand({
      TableName: TICKETS_TABLE,
      IndexName: "parentId-index",
      KeyConditionExpression: "parentId = :pid",
      ExpressionAttributeValues: { ":pid": epicId },
    })
  );

  const allTickets = result.Items || [];
  const toCancel = allTickets.filter((t) => t.status !== "done");
  skipped = allTickets.length - toCancel.length;

  // Cancel in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < toCancel.length; i += batchSize) {
    const batch = toCancel.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((ticket) =>
        ddb.send(
          new UpdateCommand({
            TableName: TICKETS_TABLE,
            Key: { ticketId: ticket.ticketId },
            UpdateExpression: "SET #s = :cancelled, cancelledAt = :ts, updatedAt = :ts",
            ConditionExpression: "#s <> :done",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":cancelled": "cancelled",
              ":done": "done",
              ":ts": now,
            },
          })
        )
      )
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        cancelled++;
      } else if (
        (r.reason as { name?: string })?.name === "ConditionalCheckFailedException"
      ) {
        skipped++;
      } else {
        failed++;
        console.warn("[cancel] Ticket update failed:", (r.reason as Error)?.message);
      }
    }
  }

  return { cancelled, skipped, failed };
}

// ─── Cancel tickets via Jira ────────────────────────────────────────────────

async function cancelTicketsJira(epicId: string) {
  const auth = getJiraAuth();
  if (!auth) {
    console.warn("[cancel] Jira not configured — skipping ticket cancellation");
    return { cancelled: 0, skipped: 0, failed: 0 };
  }

  let cancelled = 0;
  let failed = 0;

  // Search for non-Done child tickets under the epic
  const jql = encodeURIComponent(`parent = ${epicId} AND status != Done`);
  const searchRes = await fetch(
    `${auth.baseUrl}/rest/api/3/search?jql=${jql}&maxResults=100&fields=key,status`,
    {
      headers: {
        Authorization: auth.authHeader,
        Accept: "application/json",
      },
    }
  );

  if (!searchRes.ok) {
    const text = await searchRes.text().catch(() => "");
    console.error(`[cancel] Jira search failed ${searchRes.status}: ${text.slice(0, 200)}`);
    return { cancelled: 0, skipped: 0, failed: 1 };
  }

  const searchData = await searchRes.json();
  const issues = (searchData.issues || []) as Array<{ key: string }>;

  if (issues.length === 0) {
    return { cancelled: 0, skipped: 0, failed: 0 };
  }

  // Cancel in parallel batches of 5 (Jira rate-limit friendly)
  const batchSize = 5;
  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (issue) => {
        // Discover available transitions for the issue
        const transRes = await fetch(
          `${auth.baseUrl}/rest/api/3/issue/${issue.key}/transitions`,
          {
            headers: {
              Authorization: auth.authHeader,
              Accept: "application/json",
            },
          }
        );

        if (!transRes.ok) {
          throw new Error(`Failed to get transitions for ${issue.key}: ${transRes.status}`);
        }

        const transData = await transRes.json();
        const transitions = (transData.transitions || []) as Array<{
          id: string;
          name: string;
          to?: { name?: string; statusCategory?: { key?: string } };
        }>;

        // Find "Won't Do" or "Cancelled" transition
        const cancelTransition =
          transitions.find(
            (t) =>
              t.name === "Won't Do" ||
              t.name === "Cancelled" ||
              t.name === "Cancel" ||
              t.to?.name === "Won't Do" ||
              t.to?.name === "Cancelled"
          ) ||
          // Fallback: any "done" category transition
          transitions.find((t) => t.to?.statusCategory?.key === "done");

        if (!cancelTransition) {
          throw new Error(`No cancel transition available for ${issue.key}`);
        }

        // Execute the transition with "Won't Do" resolution
        const executeRes = await fetch(
          `${auth.baseUrl}/rest/api/3/issue/${issue.key}/transitions`,
          {
            method: "POST",
            headers: {
              Authorization: auth.authHeader,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transition: { id: cancelTransition.id },
              fields: { resolution: { name: "Won't Do" } },
            }),
          }
        );

        if (!executeRes.ok) {
          const text = await executeRes.text().catch(() => "");
          throw new Error(
            `Transition failed for ${issue.key}: ${executeRes.status} ${text.slice(0, 200)}`
          );
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        cancelled++;
      } else {
        failed++;
        console.warn("[cancel] Jira ticket cancel failed:", (r.reason as Error)?.message);
      }
    }
  }

  return { cancelled, skipped: 0, failed };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  // 1. Validate workflow ID
  if (!workflowId || typeof workflowId !== "string") {
    return NextResponse.json({ error: "Invalid workflow ID" }, { status: 400 });
  }

  try {
    // 2. Read current workflow state (consistent read for correctness)
    const wfResult = await ddb.send(
      new GetCommand({
        TableName: WORKFLOWS_TABLE,
        Key: { workflowId },
        ConsistentRead: true,
      })
    );

    if (!wfResult.Item) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const workflow = wfResult.Item;

    // 3. Terminal state guard — idempotent rejection
    if (TERMINAL_PHASES.includes(workflow.phase as (typeof TERMINAL_PHASES)[number])) {
      return NextResponse.json(
        { error: "Workflow already in terminal state", phase: workflow.phase },
        { status: 409 }
      );
    }

    // 4. Conditional write — atomically set phase to "cancelled"
    const cancelledAt = new Date().toISOString();
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: WORKFLOWS_TABLE,
          Key: { workflowId },
          UpdateExpression: "SET #phase = :cancelled, cancelledAt = :ts, previousPhase = :prev",
          ConditionExpression:
            "#phase <> :complete AND #phase <> :error AND #phase <> :alreadyCancelled",
          ExpressionAttributeNames: { "#phase": "phase" },
          ExpressionAttributeValues: {
            ":cancelled": "cancelled",
            ":ts": cancelledAt,
            ":prev": workflow.phase,
            ":complete": "complete",
            ":error": "error",
            ":alreadyCancelled": "cancelled",
          },
        })
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
        return NextResponse.json(
          { error: "Workflow already in terminal state", phase: workflow.phase },
          { status: 409 }
        );
      }
      throw err;
    }

    // 5. Cancel non-done tickets (best-effort — workflow is already marked cancelled)
    const epicId = workflow.epicId;
    let ticketResults: { cancelled: number; skipped: number; failed: number };

    if (TICKET_PROVIDER === "jira") {
      ticketResults = await cancelTicketsJira(epicId);
    } else {
      ticketResults = await cancelTicketsDynamoDB(epicId);
    }

    console.log(
      `[cancel] Workflow ${workflowId} cancelled (was: ${workflow.phase}). ` +
        `Tickets: ${ticketResults.cancelled} cancelled, ${ticketResults.skipped} skipped, ${ticketResults.failed} failed`
    );

    // 6. Publish event (non-fatal)
    try {
      await ddb.send(
        new PutCommand({
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
        })
      );
    } catch (eventErr) {
      console.error("[cancel] Failed to publish event (non-fatal):", eventErr);
    }

    // 7. Return success
    return NextResponse.json({ status: "cancelled", cancelledAt });
  } catch (err) {
    console.error("[cancel] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
