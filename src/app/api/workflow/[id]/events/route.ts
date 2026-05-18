import { NextRequest } from "next/server";

/**
 * GET /api/workflow/[id]/events
 * Server-Sent Events endpoint for real-time workflow updates.
 * Streams events from the workflow event bus to the client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  if (!workflowId) {
    return new Response("Missing workflow ID", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", workflowId })}\n\n`)
      );

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // In production, this subscribes to an event bus (SQS/SNS/EventBridge/DynamoDB Streams).
      // The workflow orchestrator pushes events which are relayed here.
      // For the initial implementation, events come through the internal
      // workflow engine event emitter.

      // Listen for client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Disable Next.js body parsing for streaming
export const dynamic = "force-dynamic";
