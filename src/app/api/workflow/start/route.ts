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

    // 3. Create ONLY the requirements ticket (status=todo → Stream fires → Lambda invokes).
    // The requirements agent creates all downstream tickets based on its analysis.
    const reqTicketId = await nextTicketId();

    await ddb.send(new PutCommand({
      TableName: TICKETS_TABLE,
      Item: {
        ticketId: reqTicketId,
        type: "task",
        title: `Requirements: requirements analyst — ${body.title}`,
        description: `Analyze the feature request and create tickets for the relevant agents.\n\nTitle: ${body.title}\nDescription: ${body.description}`,
        status: "todo",
        assignee: "team-requirements-analyst",
        parentId: epicId,
        workflowId,
        comments: [],
        artifacts: [],
        blockedBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    console.log(`[start] Workflow ${workflowId} created. Epic: ${epicId}. Requirements ticket ${reqTicketId} will trigger first.`);

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
