/**
 * POST /api/workflow/[id]/retry
 *
 * Restarts a stuck/failed agent by transitioning its ticket back to "Ready"
 * and updating the workflow's agentTasks status.
 *
 * Supports both DynamoDB and Jira ticket providers — reads the workflow record
 * to determine which provider to use (same as nudge endpoint).
 *
 * Body: { agentId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export const dynamic = "force-dynamic";

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

async function jiraTransitionTo(issueKey: string, targetStatus: string) {
  const data = await jiraRequest("GET", `/rest/api/3/issue/${issueKey}/transitions`);
  const transitions = (data.transitions || []) as Array<{ id: string; name: string; to?: { name?: string } }>;
  const transition = transitions.find(
    (t) => t.name === targetStatus || t.to?.name === targetStatus
  );
  if (!transition) {
    throw new Error(`No transition to "${targetStatus}" available for ${issueKey}`);
  }
  await jiraRequest("POST", `/rest/api/3/issue/${issueKey}/transitions`, {
    transition: { id: transition.id },
  });
}

// ─── Retry via Jira ─────────────────────────────────────────────────────────

async function retryJira(workflowId: string, agentId: string, agentTasks: Record<string, Record<string, unknown>>) {
  // Find the ticket for this agent
  const ticketId = Object.keys(agentTasks).find((key) => {
    const t = agentTasks[key];
    return (t.agentId === agentId || t.assignee === agentId) &&
      (t.status === "running" || t.status === "in_progress");
  });

  if (!ticketId) {
    throw new Error(`No active ticket found for agent ${agentId}`);
  }

  // Transition Jira ticket back to Ready
  try {
    await jiraTransitionTo(ticketId, "Ready");
  } catch {
    // Fallback: try "To Do" — some boards don't have "Ready"
    await jiraTransitionTo(ticketId, "To Do");
  }

  // Update workflow agentTasks status
  await ddb.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    UpdateExpression: "SET #at.#tid.#s = :s",
    ExpressionAttributeNames: { "#at": "agentTasks", "#tid": ticketId, "#s": "status" },
    ExpressionAttributeValues: { ":s": "ready" },
  }));

  return ticketId;
}

// ─── Retry via DynamoDB ─────────────────────────────────────────────────────

async function retryDynamoDB(workflowId: string, agentId: string) {
  // Find the ticket in the tickets table
  const ticketResult = await ddb.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: "workflowId = :wid AND assignee = :aid",
    ExpressionAttributeValues: { ":wid": workflowId, ":aid": agentId },
  }));

  const ticket = ticketResult.Items?.find(
    t => t.status === "in_progress" || t.status === "error" || t.status === "blocked"
  );
  if (!ticket) {
    throw new Error(`No stuck ticket found for agent ${agentId}`);
  }

  const ticketId = ticket.ticketId;

  // Reset ticket to "ready"
  await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId },
    UpdateExpression: "SET #s = :s, #u = :u",
    ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
    ExpressionAttributeValues: { ":s": "ready", ":u": new Date().toISOString() },
  }));

  // Also update workflow agentTasks
  await ddb.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    UpdateExpression: "SET #at.#tid.#s = :s",
    ExpressionAttributeNames: { "#at": "agentTasks", "#tid": ticketId, "#s": "status" },
    ExpressionAttributeValues: { ":s": "ready" },
  }));

  return ticketId;
}

// ─── Retry via workflow record only (fallback when Jira creds unavailable) ───

async function retryWorkflowOnly(workflowId: string, agentId: string, agentTasks: Record<string, Record<string, unknown>>) {
  const ticketId = Object.keys(agentTasks).find((key) => {
    const t = agentTasks[key];
    return (t.agentId === agentId || t.assignee === agentId) &&
      (t.status === "running" || t.status === "in_progress");
  });

  if (!ticketId) {
    throw new Error(`No active ticket found for agent ${agentId}`);
  }

  await ddb.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    UpdateExpression: "SET #at.#tid.#s = :s",
    ExpressionAttributeNames: { "#at": "agentTasks", "#tid": ticketId, "#s": "status" },
    ExpressionAttributeValues: { ":s": "ready" },
  }));

  return ticketId;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const { agentId } = await req.json();

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  try {
    // 1. Get workflow record to determine ticket provider
    const wfResult = await ddb.send(new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflowId },
    }));
    if (!wfResult.Item) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const workflow = wfResult.Item;
    const ticketProvider = workflow.ticketProvider || process.env.TICKET_PROVIDER || "dynamodb";
    const agentTasks = workflow.agentTasks || {};

    // 2. Get last tool events for context
    let toolSummary = "none recorded";
    let lastEventTime = "unknown";
    try {
      const eventsResult = await ddb.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: "workflowId = :wid",
        ExpressionAttributeValues: { ":wid": workflowId },
        ScanIndexForward: false,
        Limit: 50,
      }));
      const agentEvents = (eventsResult.Items || [])
        .filter(e => e.detail?.agentId === agentId && e.type === "agent.streaming" && e.detail?.type === "trace");
      if (agentEvents.length > 0) {
        toolSummary = agentEvents.slice(0, 10).map(e => e.detail?.toolName || "unknown").join(", ");
        lastEventTime = agentEvents[0]?.timestamp || "unknown";
      }
    } catch {
      // Non-critical
    }

    // 3. Execute retry based on provider (fall back to DDB if Jira not configured)
    let ticketId: string;
    if (ticketProvider === "jira" && getJiraAuth()) {
      ticketId = await retryJira(workflowId, agentId, agentTasks);
    } else if (ticketProvider === "jira" && !getJiraAuth()) {
      // Jira workflow but no creds (local dev) — just reset in workflow record
      ticketId = await retryWorkflowOnly(workflowId, agentId, agentTasks);
    } else {
      ticketId = await retryDynamoDB(workflowId, agentId);
    }

    // 4. Publish retry event
    await ddb.send(new PutCommand({
      TableName: EVENTS_TABLE,
      Item: {
        workflowId,
        timestamp: new Date().toISOString(),
        type: "agent.retry",
        detail: {
          agentId,
          ticketId,
          reason: "manual_restart",
          toolsUsedBefore: toolSummary,
          lastEventTime,
        },
      },
    }));

    return NextResponse.json({
      success: true,
      ticketId,
      agentId,
      message: `Restarting ${agentId} — ticket ${ticketId} transitioned to Ready`,
    });
  } catch (err) {
    console.error("[retry] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
