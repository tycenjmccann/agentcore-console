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
    return Response.json({ error: "Failed to list agents" }, { status: 500 });
  }
}
