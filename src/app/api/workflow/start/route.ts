import { NextRequest, NextResponse } from "next/server";
import { startWorkflow } from "@/lib/workflow/engine";
import { ensureRehydrated } from "@/lib/workflow/store";
import type { WorkflowInput } from "@/lib/workflow/types";

/**
 * POST /api/workflow/start
 * Start a new agentic team workflow.
 * Body: WorkflowInput (title, description, repoConfig, sources)
 */
export async function POST(req: NextRequest) {
  try {
    const body: WorkflowInput = await req.json();

    if (!body.title || !body.repoConfig) {
      return NextResponse.json(
        { error: "title and repoConfig are required" },
        { status: 400 }
      );
    }

    // Defaults
    if (!body.sources) body.sources = [];
    if (!body.description) body.description = "";

    // Ensure rehydration so ticket counter is synced
    await ensureRehydrated();

    const workflowId = await startWorkflow(body);

    return NextResponse.json({ workflowId });
  } catch (err) {
    console.error("Workflow start error:", err);
    return NextResponse.json(
      { error: `Failed to start workflow: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
