import { NextRequest } from "next/server";

const AGENTCORE_URL = process.env.AGENTCORE_API_URL || "";
const AGENTCORE_REGION = process.env.AWS_REGION || "us-east-1";

/**
 * POST /api/agentcore/invoke
 * Proxies agent invocation to AgentCore runtime with SSE streaming
 */
export async function POST(req: NextRequest) {
  const { agentId, prompt, sessionId } = await req.json();

  // If no AgentCore URL configured, return a mock streaming response
  if (!AGENTCORE_URL) {
    return mockStreamResponse(prompt);
  }

  try {
    const invokeUrl = `${AGENTCORE_URL}/management/api/agents/${agentId}/invoke`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (sessionId) {
      headers["X-Amzn-Bedrock-AgentCore-Runtime-Session-Id"] = sessionId;
    }

    const response = await fetch(invokeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `AgentCore returned ${response.status}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Passthrough SSE stream
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Amzn-Bedrock-AgentCore-Region": AGENTCORE_REGION,
      },
    });
  } catch (error) {
    console.error("AgentCore invoke error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to invoke agent" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function mockStreamResponse(prompt: string) {
  const encoder = new TextEncoder();
  const mockText = generateMockAgentResponse(prompt);
  const words = mockText.split(" ");

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? "" : " ") + words[i];
        const data = JSON.stringify({ type: "text", content: chunk });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        await new Promise((r) => setTimeout(r, 30 + Math.random() * 50));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
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

function generateMockAgentResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("api") || lower.includes("endpoint")) {
    return "I'll implement this API endpoint for you. Let me analyze the repository structure first...\n\nI've identified the service layer at `src/services/` and the route handlers at `src/routes/`. I'll create:\n\n1. **Route handler** - `POST /api/v1/preferences`\n2. **Service method** - `PreferencesService.update()`\n3. **Validation middleware** - Input sanitization\n4. **Unit tests** - 8 test cases covering edge cases\n\nStarting implementation now. I'll create a PR when done.";
  }
  if (lower.includes("bug") || lower.includes("fix")) {
    return "I'll investigate this bug. Let me trace through the execution path...\n\nFound it! The issue is in `src/handlers/auth.ts:47` — the token expiry check uses `<` instead of `<=`, causing tokens to be rejected at the exact second they expire.\n\n**Fix applied:**\n```diff\n- if (token.expiresAt < Date.now()) {\n+ if (token.expiresAt <= Date.now()) {\n```\n\nI've also added a regression test. PR #203 is ready for review.";
  }
  return "I'm analyzing your request and reviewing the relevant codebase sections...\n\nBased on the repository structure and existing patterns, I'll implement this following the established conventions:\n\n- Using the factory pattern for dependency injection\n- Following the existing test structure in `__tests__/`\n- Maintaining backwards compatibility with existing APIs\n\nWorking on the implementation now. Estimated completion: 3-5 minutes. I'll create a PR with full test coverage when done.";
}
