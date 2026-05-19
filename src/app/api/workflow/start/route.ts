/**
 * POST /api/workflow/start — EVENT-DRIVEN VERSION
 *
 * Creates workflow metadata in DynamoDB and a requirements ticket.
 * The DynamoDB Stream on the tickets table triggers the Orchestration Lambda,
 * which invokes the requirements agent.
 *
 * The Next.js app does NOT invoke any agents directly.
 *
 * To switch to this version, rename this file to route.ts and delete the old one.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { validateIntakeSources } from "@/lib/workflow/intake";
import type { WorkflowInput } from "@/lib/workflow/types";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const PROJECT_KEY = process.env.PROJECT_KEY || "TEAM";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

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

    // Generate IDs
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const epicId = await nextTicketId();

    // 1. Create the epic ticket in DynamoDB
    await ddb.send(new PutCommand({
      TableName: TICKETS_TABLE,
      Item: {
        ticketId: epicId,
        type: "epic",
        title: body.title,
        description: body.description,
        status: "in_progress",
        workflowId,
        comments: [],
        artifacts: [],
        blockedBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    // 2. Create workflow metadata in workflows table
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

    // 3. Pre-create ALL agent ticket skeletons with proper dependency chain.
    // Requirements agent will mark irrelevant ones as "done" (skipped).
    // This ensures cascade always works regardless of agent behavior.

    const AGENT_ROSTER = [
      { id: "team-requirements-analyst", phase: "requirements" },
      { id: "team-ios-designer", phase: "design" },
      { id: "team-backend-designer", phase: "design" },
      { id: "team-android-designer", phase: "design" },
      { id: "team-security-reviewer", phase: "design" },
      { id: "team-legal-compliance", phase: "design" },
      { id: "team-localization", phase: "design" },
      { id: "team-analytics-designer", phase: "design" },
      { id: "team-backend-dev", phase: "development" },
      { id: "team-api-dev", phase: "development" },
      { id: "team-frontend-dev", phase: "development" },
      { id: "team-qa-verifier", phase: "verification" },
      { id: "team-ci-agent", phase: "review" },
    ];

    const now = new Date().toISOString();
    const ticketIds: Record<string, string> = {};

    // Create tickets for each agent
    for (const agent of AGENT_ROSTER) {
      ticketIds[agent.id] = await nextTicketId();
    }

    const reqTicketId = ticketIds["team-requirements-analyst"];
    const designTicketIds = AGENT_ROSTER.filter(a => a.phase === "design").map(a => ticketIds[a.id]);
    const devTicketIds = AGENT_ROSTER.filter(a => a.phase === "development").map(a => ticketIds[a.id]);
    const qaTicketId = ticketIds["team-qa-verifier"];

    for (const agent of AGENT_ROSTER) {
      let blockedBy: string[] = [];
      let status = "todo";

      if (agent.phase === "design") {
        blockedBy = [reqTicketId]; // Design waits for requirements
        status = "blocked";
      } else if (agent.phase === "development") {
        blockedBy = designTicketIds; // Dev waits for ALL design
        status = "blocked";
      } else if (agent.phase === "verification") {
        blockedBy = devTicketIds; // QA waits for ALL dev
        status = "blocked";
      } else if (agent.phase === "review") {
        blockedBy = [qaTicketId]; // CI waits for QA
        status = "blocked";
      }

      const phaseLabel = agent.phase.charAt(0).toUpperCase() + agent.phase.slice(1);
      const agentName = agent.id.replace("team-", "").replace(/-/g, " ");

      await ddb.send(new PutCommand({
        TableName: TICKETS_TABLE,
        Item: {
          ticketId: ticketIds[agent.id],
          type: "task",
          title: `${phaseLabel}: ${agentName} — ${body.title}`,
          description: agent.id === "team-requirements-analyst"
            ? `Analyze the feature request and determine which agents are needed.\n\nTitle: ${body.title}\nDescription: ${body.description}\n\nFor agents that are NOT needed, use your report_completion tool to mark their tickets as "done" with reason "SKIPPED: not applicable".`
            : `Execute ${phaseLabel.toLowerCase()} work for: ${body.title}`,
          status,
          assignee: agent.id,
          parentId: epicId,
          workflowId,
          comments: [],
          artifacts: [],
          blockedBy,
          createdAt: now,
          updatedAt: now,
        },
      }));
    }

    console.log(`[start] Workflow ${workflowId} created. Epic: ${epicId}. ${AGENT_ROSTER.length} skeleton tickets pre-created. Requirements ticket ${reqTicketId} will trigger first.`);

    return NextResponse.json({ workflowId, epicId });
  } catch (err) {
    console.error("Workflow start error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function nextTicketId(): Promise<string> {
  const result = await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId: "__COUNTER__" },
    UpdateExpression: "SET #n = if_not_exists(#n, :zero) + :one",
    ExpressionAttributeNames: { "#n": "nextNum" },
    ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    ReturnValues: "UPDATED_NEW",
  }));
  return `${PROJECT_KEY}-${result.Attributes!.nextNum}`;
}
