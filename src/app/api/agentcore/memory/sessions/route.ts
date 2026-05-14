import { NextRequest, NextResponse } from "next/server";
import {
  BedrockAgentCoreClient,
  ListSessionsCommand,
  ListActorsCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { findMemoryForAgent, DEFAULT_REGION } from "@/lib/agentcore-sdk";

// Per-region client cache
const clients = new Map<string, BedrockAgentCoreClient>();
function getClient(region: string) {
  let client = clients.get(region);
  if (!client) {
    client = new BedrockAgentCoreClient({ region });
    clients.set(region, client);
  }
  return client;
}

/**
 * GET /api/agentcore/memory/sessions?agent_id=xxx
 * Lists sessions for a given agent from AgentCore Memory
 */
export async function GET(req: NextRequest) {
  const region = req.headers.get("x-aws-region") || DEFAULT_REGION;
  const agentId = req.nextUrl.searchParams.get("agent_id");
  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const memoryId = await findMemoryForAgent(agentId, region);
  if (!memoryId) {
    return NextResponse.json({ sessions: [] });
  }

  try {
    const c = getClient(region);

    // Get actors
    const actorsRes = await c.send(new ListActorsCommand({ memoryId }));
    const actors = actorsRes.actorSummaries || [];

    // Collect sessions from all actors
    const allSessions: Array<{
      sessionId: string;
      actorId: string;
      createdAt: string;
    }> = [];

    for (const actor of actors) {
      if (!actor.actorId) continue;
      const sessionsRes = await c.send(
        new ListSessionsCommand({
          memoryId,
          actorId: actor.actorId,
          maxResults: 20,
        })
      );
      for (const s of sessionsRes.sessionSummaries || []) {
        allSessions.push({
          sessionId: s.sessionId || "",
          actorId: s.actorId || "",
          createdAt: s.createdAt?.toISOString() || "",
        });
      }
    }

    // Sort by createdAt descending
    allSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ sessions: allSessions });
  } catch (error) {
    console.error("Memory sessions error:", error);
    return NextResponse.json({ sessions: [] });
  }
}
