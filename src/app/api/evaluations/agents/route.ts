import { NextResponse } from "next/server";
import { getAllEvalConfigs } from "@/lib/eval-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getAllEvalConfigs();

  const agents = items.map((item) => ({
    agentId: item.agentId,
    enabled: item.enabled,
    sampleRate: item.sampleRate,
    batchSize: item.batchSize,
    currentBufferLen: Array.isArray(item.sessionBuffer) ? item.sessionBuffer.length : 0,
    lastFlushedAt: item.lastFlushedAt,
    lastUpdatedAt: item.lastUpdatedAt,
    lastUpdatedBy: item.lastUpdatedBy,
  }));

  return NextResponse.json({ agents });
}
