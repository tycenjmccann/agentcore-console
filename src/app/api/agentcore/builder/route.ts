import { NextRequest } from "next/server";

const AGENTCORE_URL = process.env.AGENTCORE_API_URL || "";

/**
 * POST /api/agentcore/builder
 * Proxies to the harness builder agent - streams SSE responses
 * The builder agent helps users create agent configs (harness style)
 */
export async function POST(req: NextRequest) {
  const { prompt, sessionId } = await req.json();

  if (!AGENTCORE_URL) {
    return mockBuilderStream(prompt);
  }

  try {
    const builderUrl = `${AGENTCORE_URL}/harness-builder/invocations`;
    const response = await fetch(builderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, session_id: sessionId }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Builder returned ${response.status}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Builder invoke error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to invoke builder" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function mockBuilderStream(prompt: string) {
  const encoder = new TextEncoder();
  const lower = prompt.toLowerCase();

  // Determine what kind of agent the user wants
  let responseText: string;
  let config: Record<string, unknown>;

  if (lower.includes("backend") || lower.includes("api")) {
    responseText = "I'll create a Backend API agent for you. This agent will be configured to handle backend service development, API endpoint creation, and database operations.\n\nHere's the harness configuration I've generated:";
    config = {
      agent_name: "backend-api-agent",
      model_id: "anthropic.claude-sonnet-4-20250514",
      system_prompt: "You are an expert backend engineer. You write clean, well-tested code following SOLID principles. You specialize in REST API design, database schema design, and microservices architecture.",
      tools: ["code_editor", "terminal", "file_search", "git"],
      mcp_servers: {
        github: { url: "https://github.mcp.server", tools: ["create_pr", "read_file", "list_repos"] },
      },
      guardrails: { max_tokens: 8192, require_tests: true },
      memory: { type: "session", config: { ttl_hours: 24 } },
    };
  } else if (lower.includes("ios") || lower.includes("swift")) {
    responseText = "I'll create an iOS development agent for you. This agent specializes in Swift and SwiftUI development with modern async/await patterns.\n\nHere's the harness configuration:";
    config = {
      agent_name: "ios-swift-agent",
      model_id: "anthropic.claude-sonnet-4-20250514",
      system_prompt: "You are an expert iOS developer using Swift 6 and SwiftUI. You follow the Model-View pattern, use async/await for concurrency, and write comprehensive tests using Swift Testing framework.",
      tools: ["code_editor", "terminal", "file_search", "xcode_build"],
      mcp_servers: {
        xcode: { url: "https://xcode.mcp.server", tools: ["build", "test", "run_simulator"] },
      },
      guardrails: { max_tokens: 8192, require_tests: true },
      memory: { type: "session", config: { ttl_hours: 24 } },
    };
  } else if (lower.includes("security") || lower.includes("audit")) {
    responseText = "I'll create a Security Audit agent. This agent will analyze code for vulnerabilities, review authentication flows, and ensure compliance with security best practices.\n\nHere's the harness configuration:";
    config = {
      agent_name: "security-audit-agent",
      model_id: "anthropic.claude-sonnet-4-20250514",
      system_prompt: "You are a security expert specializing in application security. You review code for OWASP Top 10 vulnerabilities, analyze authentication flows, validate input handling, and ensure encryption best practices.",
      tools: ["code_editor", "file_search", "terminal", "static_analysis"],
      mcp_servers: {},
      guardrails: { max_tokens: 8192, block_secrets: true },
      memory: { type: "persistent", config: { namespace: "security-findings" } },
    };
  } else {
    responseText = "I'll help you create a custom agent. Based on your description, here's a harness configuration to get started. You can ask me to adjust any of these settings.\n\nHere's the initial configuration:";
    config = {
      agent_name: "custom-agent",
      model_id: "anthropic.claude-sonnet-4-20250514",
      system_prompt: `You are a helpful AI coding agent. ${prompt}`,
      tools: ["code_editor", "terminal", "file_search", "git"],
      mcp_servers: {},
      guardrails: { max_tokens: 8192 },
      memory: { type: "session", config: { ttl_hours: 24 } },
    };
  }

  const words = responseText.split(" ");

  const stream = new ReadableStream({
    async start(controller) {
      // Stream the text response word by word
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? "" : " ") + words[i];
        const data = JSON.stringify({ type: "text", content: chunk });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        await new Promise((r) => setTimeout(r, 25 + Math.random() * 40));
      }

      // Send the config as a structured event
      const configData = JSON.stringify({ type: "config", content: config });
      controller.enqueue(encoder.encode(`data: ${configData}\n\n`));

      // Done
      await new Promise((r) => setTimeout(r, 100));
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
