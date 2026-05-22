import { NextRequest, NextResponse } from "next/server";
import { getWorkflowFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const state = await getWorkflowFromDynamo(params.id);
    if (!state) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[state] Error fetching workflow ${params.id}:`, err);
    return NextResponse.json(
      { error: `Failed to fetch workflow state: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
