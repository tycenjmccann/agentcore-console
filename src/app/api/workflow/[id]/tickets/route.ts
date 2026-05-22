import { NextRequest, NextResponse } from "next/server";
import { getWorkflowFromDynamo, getTicketsForWorkflowFromDynamo } from "@/lib/workflow/dynamo-read";
import { getTicketsForWorkflowFromJira } from "@/lib/workflow/jira-read";

export const dynamic = "force-dynamic";

const TICKET_PROVIDER = process.env.TICKET_PROVIDER || "dynamodb";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Workflow metadata always lives in DDB (agentis-workflows table)
    const state = await getWorkflowFromDynamo(params.id);
    if (!state) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Tickets come from the configured provider
    let tickets;
    if (TICKET_PROVIDER === "jira") {
      tickets = await getTicketsForWorkflowFromJira(params.id);
    } else {
      tickets = await getTicketsForWorkflowFromDynamo(params.id);
    }

    return NextResponse.json({ tickets }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[tickets] Error fetching tickets for ${params.id}:`, err);
    return NextResponse.json(
      { error: `Failed to fetch tickets: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
