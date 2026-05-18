import { NextResponse } from "next/server";
import { listWorkflows, ensureRehydrated } from "@/lib/workflow/store";

export async function GET() {
  await ensureRehydrated();
  const workflows = listWorkflows();
  return NextResponse.json({ workflows });
}
