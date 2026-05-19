/**
 * POST /api/workflow/webhook — EVENT-DRIVEN VERSION
 *
 * This is the THIN webhook handler. It does NOT orchestrate anything.
 * It simply writes status changes to DynamoDB. The DynamoDB Stream
 * triggers the Orchestration Lambda which handles all downstream logic.
 *
 * To switch to this version, rename this file to route.ts and delete the old one.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "dev-secret";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (WEBHOOK_SECRET !== "dev-secret" && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.event_type as string;

  try {
    switch (eventType) {
      // ─── Agent Completion → just write "done" to DynamoDB ──────────────────
      case "agent_completion": {
        const workflowId = body.workflow_id as string;
        const agentId = body.agent_id as string;

        if (!workflowId || !agentId) {
          return NextResponse.json({ error: "workflow_id and agent_id required" }, { status: 400 });
        }

        // Find the ticket for this agent
        const ticketId = await findTicketForAgent(workflowId, agentId);
        if (!ticketId) {
          return NextResponse.json({ received: true, warning: "Ticket not found" });
        }

        // Write "done" to DynamoDB — the Stream handles the rest
        await ddb.send(new UpdateCommand({
          TableName: TICKETS_TABLE,
          Key: { ticketId },
          UpdateExpression: "SET #s = :s, #u = :u",
          ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
          ExpressionAttributeValues: { ":s": "done", ":u": new Date().toISOString() },
        }));

        // Optionally store completion metadata on the workflow
        if (body.branch || body.commit_sha || body.pr_url) {
          await updateWorkflowTaskMetadata(workflowId, agentId, {
            branch: body.branch as string,
            commitSha: body.commit_sha as string,
            prUrl: body.pr_url as string,
            output: (body.output as string)?.slice(0, 10000),
          });
        }

        console.log(`[webhook] Wrote "done" for ${ticketId} (agent: ${agentId}). Stream will handle cascade.`);
        return NextResponse.json({ received: true, ticketId });
      }

      // ─── QA Fix Request → create fix ticket in DynamoDB (stream handles invocation) ─
      case "request_fix": {
        const workflowId = body.workflow_id as string;
        const targetAgent = body.target_agent as string;
        const findings = body.findings as string;
        const qaTicketId = body.qa_ticket_id as string;

        if (!workflowId || !targetAgent || !findings || !qaTicketId) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Mark QA ticket as blocked
        await ddb.send(new UpdateCommand({
          TableName: TICKETS_TABLE,
          Key: { ticketId: qaTicketId },
          UpdateExpression: "SET #s = :s, #u = :u",
          ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
          ExpressionAttributeValues: { ":s": "blocked", ":u": new Date().toISOString() },
        }));

        // Create fix ticket (status=todo, no blockers → stream will invoke the dev agent)
        const fixTicketId = await nextTicketId();
        const workflow = await getWorkflow(workflowId);
        const epicId = workflow?.epicId;

        await ddb.send(new UpdateCommand({
          TableName: TICKETS_TABLE,
          Key: { ticketId: fixTicketId },
          UpdateExpression: "SET #t = :t, #title = :title, #desc = :desc, #s = :s, #a = :a, #pid = :pid, #wid = :wid, #bb = :bb, #c = :c, #art = :art, #ca = :ca, #u = :u",
          ExpressionAttributeNames: {
            "#t": "type", "#title": "title", "#desc": "description", "#s": "status",
            "#a": "assignee", "#pid": "parentId", "#wid": "workflowId",
            "#bb": "blockedBy", "#c": "comments", "#art": "artifacts", "#ca": "createdAt", "#u": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":t": "task",
            ":title": `Fix: QA findings`,
            ":desc": `## Fix Required\n\n### QA Findings:\n${findings}\n\n### Instructions:\n1. Fix the issues on the feature branch\n2. Push the fix commit\n3. Call report_completion when done`,
            ":s": "todo",
            ":a": targetAgent,
            ":pid": epicId,
            ":wid": workflowId,
            ":bb": [],
            ":c": [],
            ":art": [],
            ":ca": new Date().toISOString(),
            ":u": new Date().toISOString(),
          },
        }));

        console.log(`[webhook] Created fix ticket ${fixTicketId} for ${targetAgent}. Stream will invoke.`);
        return NextResponse.json({ received: true, fixTicketId });
      }

      // ─── Jira webhook (native format) → write status to DynamoDB ───────────
      case "jira_transition":
      case undefined: {
        const issueKey = (body.issue_key as string) || (body.issue as { key?: string })?.key;
        const changelog = body.changelog as { items?: Array<{ field: string; toString: string }> };
        const statusChange = changelog?.items?.find((i: { field: string }) => i.field === "status");

        if (issueKey && statusChange) {
          const newStatus = statusChange.toString.toLowerCase();
          const mappedStatus = mapJiraStatus(newStatus);

          await ddb.send(new UpdateCommand({
            TableName: TICKETS_TABLE,
            Key: { ticketId: issueKey },
            UpdateExpression: "SET #s = :s, #u = :u",
            ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
            ExpressionAttributeValues: { ":s": mappedStatus, ":u": new Date().toISOString() },
          }));

          console.log(`[webhook] Jira: ${issueKey} → ${mappedStatus}. Stream handles cascade.`);
          return NextResponse.json({ received: true, processed: true });
        }

        return NextResponse.json({ received: true, ignored: true });
      }

      default:
        return NextResponse.json({ received: true, ignored: true });
    }
  } catch (err) {
    console.error("[webhook] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function findTicketForAgent(workflowId: string, agentId: string): Promise<string | null> {
  const wf = await getWorkflow(workflowId);
  return wf?.agentTasks?.[agentId]?.ticketId || null;
}

async function getWorkflow(workflowId: string) {
  const result = await ddb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { workflowId } }));
  return result.Item || null;
}

async function updateWorkflowTaskMetadata(workflowId: string, agentId: string, metadata: Record<string, unknown>) {
  const wf = await getWorkflow(workflowId);
  if (!wf) return;
  const tasks = wf.agentTasks || {};
  tasks[agentId] = { ...tasks[agentId], ...metadata, status: "complete", completedAt: new Date().toISOString() };

  await ddb.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    UpdateExpression: "SET #at = :at, #u = :u",
    ExpressionAttributeNames: { "#at": "agentTasks", "#u": "updatedAt" },
    ExpressionAttributeValues: { ":at": tasks, ":u": new Date().toISOString() },
  }));
}

async function nextTicketId(): Promise<string> {
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

function mapJiraStatus(jiraStatus: string): string {
  const map: Record<string, string> = {
    "to do": "todo",
    "in progress": "in_progress",
    "done": "done",
    "blocked": "blocked",
    "in review": "in_review",
  };
  return map[jiraStatus] || jiraStatus;
}
