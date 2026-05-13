import { NextResponse } from "next/server";

const ABCA_API_URL = process.env.ABCA_API_URL;
const ABCA_API_KEY = process.env.ABCA_API_KEY;

export async function GET() {
  if (!ABCA_API_URL) {
    // Return mock agent data when ABCA is not configured
    return NextResponse.json([
      { agent_id: "agent-backend-001", name: "Backend Agent", description: "Full-stack backend development", status: "ACTIVE", blueprint_id: "bp-backend", total_tasks: 47, successful_tasks: 44, failed_tasks: 3, last_invoked: new Date(Date.now() - 720000).toISOString(), created_at: "2026-04-15T00:00:00Z" },
      { agent_id: "agent-ios-001", name: "iOS Agent", description: "SwiftUI development, iOS features", status: "ACTIVE", blueprint_id: "bp-ios", total_tasks: 31, successful_tasks: 28, failed_tasks: 3, last_invoked: new Date(Date.now() - 3600000).toISOString(), created_at: "2026-04-15T00:00:00Z" },
      { agent_id: "agent-android-001", name: "Android Agent", description: "Kotlin/Jetpack Compose development", status: "ACTIVE", blueprint_id: "bp-android", total_tasks: 22, successful_tasks: 20, failed_tasks: 2, last_invoked: new Date(Date.now() - 7200000).toISOString(), created_at: "2026-04-20T00:00:00Z" },
      { agent_id: "agent-security-001", name: "Security Agent", description: "Security reviews and compliance", status: "ACTIVE", blueprint_id: "bp-security", total_tasks: 15, successful_tasks: 15, failed_tasks: 0, last_invoked: new Date(Date.now() - 1800000).toISOString(), created_at: "2026-04-20T00:00:00Z" },
    ]);
  }

  try {
    const res = await fetch(`${ABCA_API_URL}/agents`, {
      headers: {
        ...(ABCA_API_KEY ? { "x-api-key": ABCA_API_KEY } : {}),
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch agents from ABCA" }, { status: 502 });
  }
}
