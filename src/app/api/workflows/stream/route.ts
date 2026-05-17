import { NextRequest } from "next/server";

// SSE endpoint for streaming workflow events
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("id");

  if (!workflowId) {
    return new Response("Missing workflow ID", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `data: ${JSON.stringify({
        type: "connected",
        workflowId,
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Simulate workflow events (in production, this would listen to actual events)
      const interval = setInterval(() => {
        const event = {
          type: "agent_status",
          agentId: "team-frontend-dev",
          status: "running",
          timestamp: new Date().toISOString()
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }, 5000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}