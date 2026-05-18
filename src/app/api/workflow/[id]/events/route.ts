import { NextRequest } from "next/server";
import { WorkflowEvent } from "@/lib/workflow/types";

// SSE client registry - tracks active connections per workflow
const eventStreams = new Map<string, Set<ReadableStreamDefaultController>>();

/**
 * SSE endpoint for workflow events
 * GET /api/workflow/[id]/events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  const stream = new ReadableStream({
    start(controller) {
      // Register this client
      if (!eventStreams.has(workflowId)) {
        eventStreams.set(workflowId, new Set());
      }
      eventStreams.get(workflowId)!.add(controller);

      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        const clients = eventStreams.get(workflowId);
        if (clients) {
          clients.delete(controller);
          if (clients.size === 0) {
            eventStreams.delete(workflowId);
          }
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Broadcast an event to all clients watching a workflow
 * Called by workflow orchestrator when state changes
 */
export function broadcastWorkflowEvent(
  workflowId: string,
  event: WorkflowEvent
) {
  const clients = eventStreams.get(workflowId);
  if (!clients || clients.size === 0) return;

  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;

  clients.forEach((controller) => {
    try {
      controller.enqueue(encoder.encode(data));
    } catch (error) {
      console.error("Failed to send event to client:", error);
      clients.delete(controller);
    }
  });
}
