import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, getTicketsForWorkflow, ensureRehydrated } from "@/lib/workflow/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureRehydrated();
  const state = getWorkflow(params.id);
  if (!state) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  const tickets = getTicketsForWorkflow(state.epicId);
  return NextResponse.json({ tickets }, {
    headers: { "Cache-Control": "no-store" },
  });
}
