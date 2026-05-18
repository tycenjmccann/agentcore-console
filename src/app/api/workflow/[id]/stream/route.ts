import { NextRequest } from "next/server";
import { addSubscriber, removeSubscriber, ensureRehydrated } from "@/lib/workflow/store";

/**
 * GET /api/workflow/[id]/stream
 * Server-Sent Events endpoint for real-time workflow updates.
 *
 * Uses the existing store subscriber system to forward events to clients.
 * The client receives WorkflowEvent objects as SSE data messages.
 *
 * The store's emitEvent() sends formatted SSE data directly to
 * subscribed controllers, so this route just sets up the plumbing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRehydrated();
  const workflowId = params.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial comment to confirm connection established
      controller.enqueue(encoder.encode(":connected\n\n"));

      // Register this controller as a subscriber
      // The store's emitEvent will push formatted SSE data directly
      addSubscriber(workflowId, controller);

      // Keep-alive heartbeat every 30 seconds to prevent timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeSubscriber(workflowId, controller);
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
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
