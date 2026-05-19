import { NextResponse } from "next/server";
import { listWorkflowsFromDynamo } from "@/lib/workflow/dynamo-read";

export const dynamic = "force-dynamic";

export async function GET() {
  const workflows = await listWorkflowsFromDynamo();
  return NextResponse.json({ workflows });
}
