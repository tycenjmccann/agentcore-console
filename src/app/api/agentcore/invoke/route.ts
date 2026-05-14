import { NextRequest } from "next/server";
import { invokeAgentRuntime, invokeHarnessAgent } from "@/lib/agentcore-sdk";

/**
 * POST /api/agentcore/invoke
 * Invokes a deployed AgentCore agent with streaming response.
 * Detects harness agents (name starts with "harness_") and routes accordingly.
 */
export async function POST(req: NextRequest) {
  const { agentRuntimeArn, agentId, prompt, sessionId, isHarness, systemPrompt, history } = await req.json();

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const sid = sessionId || `sess-${crypto.randomUUID().replace(/-/g, "")}${Date.now()}`;

  try {
    let stream: ReadableStream;

    if (isHarness) {
      // Harness agents use InvokeHarness API with the full harness ARN
      stream = await invokeHarnessAgent({
        harnessArn: agentRuntimeArn,
        prompt,
        sessionId: sid,
        systemPrompt,
        history,
      });
    } else if (agentRuntimeArn) {
      // Regular runtime agents use InvokeAgentRuntime
      stream = await invokeAgentRuntime({
        agentRuntimeArn,
        prompt,
        sessionId: sid,
      });
    } else {
      return Response.json({ error: "agentRuntimeArn or isHarness required" }, { status: 400 });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Invoke error:", error);
    return Response.json(
      { error: `Failed to invoke: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
