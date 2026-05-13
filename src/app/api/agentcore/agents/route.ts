import { NextRequest } from "next/server";

const AGENTCORE_URL = process.env.AGENTCORE_API_URL || "";

/**
 * GET /api/agentcore/agents
 * Lists available agents from AgentCore runtime
 */
export async function GET(_req: NextRequest) {
  if (!AGENTCORE_URL) {
    // Return mock agents when no AgentCore URL configured
    return Response.json([
      { id: "agent-backend-001", name: "Backend Agent", description: "Handles backend service development", status: "ACTIVE" },
      { id: "agent-ios-001", name: "iOS Agent", description: "Swift/SwiftUI development", status: "ACTIVE" },
      { id: "agent-android-001", name: "Android Agent", description: "Kotlin/Android development", status: "ACTIVE" },
      { id: "agent-security-001", name: "Security Agent", description: "Security audits and fixes", status: "ACTIVE" },
      { id: "agent-analytics-001", name: "Analytics Agent", description: "Event tracking instrumentation", status: "ACTIVE" },
    ]);
  }

  try {
    const response = await fetch(`${AGENTCORE_URL}/management/api/agents`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return Response.json({ error: `AgentCore returned ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("AgentCore list agents error:", error);
    return Response.json({ error: "Failed to list agents" }, { status: 500 });
  }
}
