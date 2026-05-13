import { NextRequest } from "next/server";

const AGENTCORE_URL = process.env.AGENTCORE_API_URL || "";

/**
 * POST /api/agentcore/deploy
 * Deploys a harness config as a new agent on AgentCore
 */
export async function POST(req: NextRequest) {
  const config = await req.json();

  if (!AGENTCORE_URL) {
    // Mock deployment response
    await new Promise((r) => setTimeout(r, 1000));
    return Response.json({
      agentId: `agent-${config.agent_name}-${Date.now().toString(36)}`,
      status: "DEPLOYING",
      message: `Agent "${config.agent_name}" deployment initiated. It will be available in ~30 seconds.`,
    });
  }

  try {
    const response = await fetch(`${AGENTCORE_URL}/management/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      return Response.json(
        { error: `AgentCore returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("AgentCore deploy error:", error);
    return Response.json({ error: "Failed to deploy agent" }, { status: 500 });
  }
}
