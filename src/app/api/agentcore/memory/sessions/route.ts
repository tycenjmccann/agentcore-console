import { NextRequest, NextResponse } from "next/server";
import {
  BedrockAgentCoreClient,
  ListSessionsCommand,
  ListActorsCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { findMemoryForAgent } from "@/lib/agentcore-sdk";

const REGION = process.env.AWS_REGION || "us-east-1";

let client: BedrockAgentCoreClient | null = null;
function getClient() {
  if (!client) client = new BedrockAgentCoreClient({ region: REGION });
  return client;
}

/**
 * GET /api/agentcore/memory/sessions?agent_id=xxx
 * Lists sessions for a given agent from AgentCore Memory
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent_id");
  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const memoryId = await findMemoryForAgent(agentId);
  if (!memoryId) {
    return NextResponse.json({ sessions: [] });
  }

  try {
    const c = getClient();

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
