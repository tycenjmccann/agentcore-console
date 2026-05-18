import { NextRequest } from "next/server";
import { getWorkflow, addSubscriber, removeSubscriber, ensureRehydrated } from "@/lib/workflow/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRehydrated();
  const state = getWorkflow(params.id);
  if (!state) {
    return new Response("Workflow not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // The store's emitEvent sends pre-formatted Uint8Array SSE data directly
      addSubscriber(params.id, controller);

      // Send initial heartbeat
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      // Cleanup on close
      _req.signal.addEventListener("abort", () => {
        removeSubscriber(params.id, controller);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
