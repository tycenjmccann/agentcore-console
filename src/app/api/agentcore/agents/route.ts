import { NextRequest } from "next/server";
import { discoverAgents, getHarnessDetail, findMemoryForAgent, findLogGroupForAgent } from "@/lib/agentcore-sdk";

/**
 * GET /api/agentcore/agents
 * Dynamically discovers all agents (harnesses + runtimes) in the account.
 *
 * GET /api/agentcore/agents?id=xxx
 * Returns enriched detail for a specific agent (memory, log group, model, tools).
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("id");

  try {
    const agents = await discoverAgents();

    // If requesting a specific agent's detail
    if (agentId) {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) {
        return Response.json({ error: "Agent not found" }, { status: 404 });
      }

      // Enrich with detail
      const [memoryId, logGroup, detail] = await Promise.all([
        findMemoryForAgent(agentId),
        findLogGroupForAgent(agentId, agent.name),
        agent.type === "harness" ? getHarnessDetail(agentId) : Promise.resolve({}),
      ]);

      return Response.json({
        ...agent,
        memoryId,
        logGroup,
        ...detail,
      });
    }

    return Response.json(agents);
  } catch (error) {
    console.error("List agents error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Surface useful info: credential issues, access denied, etc.
    let hint = "";
    if (message.includes("Could not load credentials") || message.includes("CredentialsProviderError")) {
      hint = "AWS credentials not found. Configure ~/.aws/credentials or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables.";
    } else if (message.includes("AccessDenied") || message.includes("not authorized")) {
      hint = "IAM permissions missing. Ensure your role/user has bedrock-agentcore:ListHarnesses and bedrock-agentcore:ListAgentRuntimes permissions.";
    } else if (message.includes("ExpiredToken") || message.includes("expired")) {
      hint = "AWS credentials have expired. Refresh your session (e.g., re-run aws sso login).";
    }
    return Response.json(
      { error: hint || message },
      { status: 500 }
    );
  }
}
