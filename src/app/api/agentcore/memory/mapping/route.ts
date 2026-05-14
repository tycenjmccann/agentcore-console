import { NextRequest } from "next/server";
import {
  setMemoryMapping,
  removeMemoryMapping,
  getAllMemoryMappings,
  discoverMemories,
} from "@/lib/agentcore-sdk";

/**
 * GET /api/agentcore/memory/mapping
 * Returns all agent→memory mappings and available memories.
 */
export async function GET() {
  const [mappings, memories] = await Promise.all([
    Promise.resolve(getAllMemoryMappings()),
    discoverMemories(),
  ]);

  return Response.json({ mappings, memories });
}

/**
 * POST /api/agentcore/memory/mapping
 * Set a memory mapping: { agentId, memoryId }
 */
export async function POST(req: NextRequest) {
  const { agentId, memoryId } = await req.json();

  if (!agentId) {
    return Response.json({ error: "agentId required" }, { status: 400 });
  }

  if (memoryId) {
    setMemoryMapping(agentId, memoryId);
  } else {
    removeMemoryMapping(agentId);
  }

  return Response.json({ success: true, mappings: getAllMemoryMappings() });
}
