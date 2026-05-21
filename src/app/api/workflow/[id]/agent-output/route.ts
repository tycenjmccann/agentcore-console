/**
 * GET /api/workflow/[id]/agent-output?agentId=team-frontend-dev
 *
 * Returns ALL text events for a specific agent in a workflow.
 * Concatenates all agent.streaming (type=text) events into a single string.
 * This is independent of replay/scrubber position — always returns the full output.
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const agentId = req.nextUrl.searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId query param required" }, { status: 400 });
  }

  // Query all events for this workflow, then filter for this agent's text output
  let textChunks: string[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "workflowId = :wid",
      ExpressionAttributeValues: { ":wid": workflowId },
      ScanIndexForward: true,
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      const eventType = item.type as string;
      const detail = (item.detail || {}) as Record<string, unknown>;

      // Match agent.streaming events with type=text for this agent
      if (eventType === "agent.streaming" && detail.agentId === agentId && detail.type === "text") {
        const content = detail.content as string;
        if (content) textChunks.push(content);
      }
      // Also capture agent.text events (legacy format)
      if (eventType === "agent.text" && detail.agentId === agentId) {
        const content = (detail.content || detail.text) as string;
        if (content) textChunks.push(content);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  const fullOutput = textChunks.join("");

  return NextResponse.json({
    agentId,
    workflowId,
    output: fullOutput,
    chunks: textChunks.length,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
