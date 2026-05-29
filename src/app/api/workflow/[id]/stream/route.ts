/**
 * GET /api/workflow/[id]/stream — EVENT-DRIVEN VERSION
 *
 * SSE endpoint that polls the agentis-events DynamoDB table for new events.
 * Events are written there by the EventBridge → events-writer Lambda.
 *
 * No in-process subscribers. The Next.js app is stateless.
 *
 * To switch to this version, rename this file to route.ts and delete the old one.
 */

import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Transform EventBridge/agent-invoker events into the format usePipelineSSE expects.
 *
 * Source (DDB):  { type: "agent.streaming", detail: { agentId, type: "text"|"trace", content?, toolName? } }
 * Target (UI):   { type: "agent_output"|"agent_status"|"agent_complete"|"error", agentId, ... }
 */
function transformEvent(item: Record<string, unknown>): Record<string, unknown> | null {
  const eventType = item.type as string;
  const detail = (item.detail || {}) as Record<string, unknown>;
  const agentId = detail.agentId as string;
  const timestamp = item.timestamp as string;

  switch (eventType) {
    case "agent.streaming": {
      const subType = detail.type as string;
      if (subType === "text") {
        return { type: "agent_output", agentId, chunk: detail.content, timestamp };
      }
      if (subType === "trace") {
        // Tool invocation trace — emit as tool_use to light up tool indicators
        return { type: "tool_use", agentId, toolName: detail.toolName, timestamp };
      }
      return null;
    }

    case "agent.complete":
      return {
        type: "agent_complete",
        agentId,
        output: detail.output,
        branch: detail.branch,
        commitSha: detail.commitSha,
        timestamp,
      };

    case "agent.error":
      return { type: "error", agentId, error: detail.error, timestamp };

    case "agent.started":
    case "agent.invoked":
      return { type: "agent_status", agentId: agentId || detail.assignee as string, status: "running", ticketId: detail.ticketId as string, timestamp };

    case "workflow.report_completion":
      // Agent reported done — emit agent_complete immediately (don't wait for Jira webhook cascade)
      if (detail.agentId) {
        return {
          type: "agent_complete",
          agentId: detail.agentId as string,
          output: detail.summary,
          branch: detail.branch,
          timestamp,
        };
      }
      return null;

    case "workflow.phase_change":
      return { type: "phase_change", phase: detail.phase, timestamp };

    case "workflow.complete":
      return { type: "workflow_complete", timestamp };

    case "ticket.created":
      // Orchestrator publishes this when a new ticket is tracked. Surface it to the UI
      // so badges render immediately, without polling.
      if (detail.ticket) {
        return { type: "ticket_created", ticket: detail.ticket, timestamp };
      }
      return null;

    default:
      // Pass through unknown events as-is
      return { type: eventType, ...detail, timestamp };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const encoder = new TextEncoder();
  // Allow client to specify a cursor to skip already-replayed events
  let lastEventId = req.nextUrl.searchParams.get("cursor") || "";
  let stopped = false;

  req.signal.addEventListener("abort", () => { stopped = true; });

  const stream = new ReadableStream({
    async start(controller) {
      // Send heartbeat
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      // Poll loop — check for new events every 1 second.
      // Emit a heartbeat comment every ~15s of idle time so App Runner doesn't
      // close the connection during long phase gaps (idle TCP gets killed).
      const poll = async () => {
        let tick = 0;
        while (!stopped) {
          try {
            const result = await ddb.send(new QueryCommand({
              TableName: EVENTS_TABLE,
              KeyConditionExpression: "workflowId = :wid" + (lastEventId ? " AND eventId > :eid" : ""),
              ExpressionAttributeValues: {
                ":wid": workflowId,
                ...(lastEventId ? { ":eid": lastEventId } : {}),
              },
              ScanIndexForward: true,
              Limit: 50,
            }));

            const items = result.Items || [];
            for (const item of items) {
              // Transform EventBridge event format → UI event format
              const uiEvent = transformEvent(item);
              if (uiEvent) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(uiEvent)}\n\n`));
              }
              lastEventId = item.eventId;
            }

            // Idle heartbeat every 15 ticks (~15s) keeps the connection alive
            // through App Runner's idle-connection killer.
            if (tick % 15 === 0) {
              controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
            }
            tick++;
          } catch (err) {
            // Log but don't crash — keep polling
            console.warn(`[stream] Poll error for ${workflowId}:`, (err as Error).message);
          }

          // Wait 1 second before next poll
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        controller.close();
      };

      poll().catch(() => controller.close());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (App Runner / nginx-style) so SSE chunks
      // reach the browser immediately instead of being held in the proxy buffer.
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  });
}
