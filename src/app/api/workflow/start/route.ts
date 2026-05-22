/**
 * POST /api/workflow/start — EVENT-DRIVEN VERSION
 *
 * Creates workflow metadata and a requirements ticket.
 * Supports two backends:
 *   - TICKET_PROVIDER=dynamodb → DynamoDB direct (mock Jira) + DDB Stream trigger
 *   - TICKET_PROVIDER=jira → Real Jira Cloud + webhook trigger
 *
 * The Next.js app does NOT invoke any agents directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { validateIntakeSources } from "@/lib/workflow/intake";
import type { WorkflowInput } from "@/lib/workflow/types";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || process.env.PROJECT_KEY || "TEAM";
const TICKET_PROVIDER = process.env.TICKET_PROVIDER || "dynamodb";
const JIRA_TOOLS_LAMBDA = process.env.JIRA_TOOLS_LAMBDA || "agentis-jira-real";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const lambda = new LambdaClient({ region: REGION });

export async function POST(req: NextRequest) {
  try {
    const body: WorkflowInput = await req.json();

    if (!body.title || !body.repoConfig) {
      return NextResponse.json({ error: "title and repoConfig are required" }, { status: 400 });
    }

    if (!body.sources) body.sources = [];
    if (!body.description) body.description = "";

    // Validate sources are reachable
    if (body.sources.length > 0) {
      const errors = await validateIntakeSources(body.sources);
      if (errors.length > 0) {
        return NextResponse.json({ error: "Source validation failed", details: errors }, { status: 422 });
      }
    }

    if (TICKET_PROVIDER === "jira") {
      return await startWithJira(body);
    } else {
      return await startWithDynamoDB(body);
    }
  } catch (err) {
    console.error("Workflow start error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ─── Jira Cloud Backend ────────────────────────────────────────────────────────

async function startWithJira(body: WorkflowInput) {
  const { JiraCloudProvider } = await import("@/lib/workflow/ticket-provider-jira");
  const jira = new JiraCloudProvider();

  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Create epic in Jira
  const epic = await jira.createEpic({ title: body.title, description: body.description });
  const epicId = epic.id;

  // 2. Create workflow metadata in DynamoDB (this is app state, not tickets —
  //    the orchestrator needs it for context building regardless of ticket backend)
  await ddb.send(new PutCommand({
    TableName: WORKFLOWS_TABLE,
    Item: {
      workflowId,
      id: workflowId,
      phase: "requirements",
      epicId,
      repoConfig: body.repoConfig,
      input: body,
      agentTasks: {},
      messages: [],
      humanNotifications: [],
      startedAt: new Date().toISOString(),
      ticketProvider: "jira",
    },
  }));

  // 3. Create requirements ticket in Jira
  const reqTicket = await jira.createTicket({
    parentId: epicId,
    title: `Requirements: requirements analyst — ${body.title}`,
    description: `Analyze the feature request and create tickets for the relevant agents.\n\nTitle: ${body.title}\nDescription: ${body.description}`,
    assignee: "team-requirements-analyst",
    blockedBy: [],
  }, workflowId);

  // Webhook fires on issue_created → orchestrator checks blockers → transitions to Ready → invokes agent
  console.log(`[start/jira] Workflow ${workflowId} created. Epic: ${epicId}. Req ticket: ${reqTicket.id}. Webhook will handle the rest.`);

  return NextResponse.json({ workflowId, epicId });
}

// ─── DynamoDB Backend (dual-write via jira-real Lambda) ───────────────────────

async function startWithDynamoDB(body: WorkflowInput) {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Create the epic via jira-real Lambda (dual-writes to Jira Cloud + DDB)
  const epicResult = await invokeJiraLambda("JiraIntegration___create_ticket", {
    summary: body.title,
    description: body.description || "",
    issue_type: "Epic",
    workflow_id: workflowId,
  });

  if (epicResult.error) {
    throw new Error(`Failed to create epic in Jira: ${epicResult.error}`);
  }

  const epicId = epicResult.ticketId;

  // 2. Transition epic to in_progress in both systems
  await invokeJiraLambda("JiraIntegration___transition_ticket", {
    ticket_id: epicId,
    transition_id: "in_progress",
  });

  // 3. Create workflow metadata in workflows table
  await ddb.send(new PutCommand({
    TableName: WORKFLOWS_TABLE,
    Item: {
      workflowId,
      id: workflowId,
      phase: "requirements",
      epicId,
      repoConfig: body.repoConfig,
      input: body,
      agentTasks: {},
      messages: [],
      humanNotifications: [],
      startedAt: new Date().toISOString(),
    },
  }));

  // 4. Create requirements ticket via jira-real Lambda (dual-write)
  //    DDB write triggers Stream → orchestrator Lambda picks it up
  const reqResult = await invokeJiraLambda("JiraIntegration___create_ticket", {
    summary: `Requirements: requirements analyst — ${body.title}`,
    description: `Analyze the feature request and create tickets for the relevant agents.\n\nTitle: ${body.title}\nDescription: ${body.description}`,
    issue_type: "Task",
    parent_key: epicId,
    assignee: "team-requirements-analyst",
    workflow_id: workflowId,
  });

  if (reqResult.error) {
    throw new Error(`Failed to create requirements ticket: ${reqResult.error}`);
  }

  const reqTicketId = reqResult.ticketId;

  console.log(`[start] Workflow ${workflowId} created via dual-write. Epic: ${epicId}. Requirements ticket ${reqTicketId} will trigger first.`);

  return NextResponse.json({ workflowId, epicId });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function invokeJiraLambda(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await lambda.send(new InvokeCommand({
    FunctionName: JIRA_TOOLS_LAMBDA,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify({
      tool_name: toolName,
      parameters: params,
    })),
  }));

  const payload = JSON.parse(new TextDecoder().decode(resp.Payload));
  // Lambda may return the result directly or wrapped in a body
  if (typeof payload === "string") return JSON.parse(payload);
  return payload;
}
