import { NextRequest, NextResponse } from "next/server";
import { getAllEvalConfigs, updateEvalConfig } from "@/lib/eval-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getAllEvalConfigs();
  const enabled = items.length > 0 && items.every((item) => item.enabled === true);
  return NextResponse.json({ enabled });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 }
    );
  }

  const items = await getAllEvalConfigs();

  for (const item of items) {
    await updateEvalConfig(item.agentId as string, {
      enabled,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: "console-user",
    });
  }

  console.log(`[eval-config] Bulk ${enabled ? "enabled" : "disabled"} all agents (${items.length} updated)`);

  return NextResponse.json({
    enabled,
    agentsUpdated: items.length,
  });
}
