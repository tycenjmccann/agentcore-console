import { NextRequest, NextResponse } from "next/server";

const ABCA_API_URL = process.env.ABCA_API_URL;
const ABCA_API_KEY = process.env.ABCA_API_KEY;

export async function GET() {
  if (!ABCA_API_URL) {
    // Return mock data when ABCA is not configured
    return NextResponse.json([
      { task_id: "t-010", status: "COMPLETED", task_description: "Add user preferences API", repo: "tinder/backend-api", created_at: new Date(Date.now() - 300000).toISOString(), updated_at: new Date().toISOString(), user_id: "dev-1" },
      { task_id: "t-009", status: "RUNNING", task_description: "Fix auth token refresh logic", repo: "tinder/ios-app", created_at: new Date(Date.now() - 600000).toISOString(), updated_at: new Date().toISOString(), user_id: "dev-1" },
      { task_id: "t-008", status: "COMPLETED", task_description: "Audit payment endpoint", repo: "tinder/gateway", created_at: new Date(Date.now() - 900000).toISOString(), updated_at: new Date().toISOString(), user_id: "dev-2" },
    ]);
  }

  try {
    const res = await fetch(`${ABCA_API_URL}/tasks`, {
      headers: {
        ...(ABCA_API_KEY ? { "x-api-key": ABCA_API_KEY } : {}),
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tasks from ABCA" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!ABCA_API_URL) {
    // Mock task creation
    return NextResponse.json({
      task_id: `t-${Date.now()}`,
      status: "SUBMITTED",
      task_description: body.task_description,
      repo: body.repo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: "dev-1",
    }, { status: 201 });
  }

  try {
    const res = await fetch(`${ABCA_API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ABCA_API_KEY ? { "x-api-key": ABCA_API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create task in ABCA" }, { status: 502 });
  }
}
