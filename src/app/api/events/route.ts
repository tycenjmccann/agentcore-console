import { NextRequest, NextResponse } from "next/server";

const ABCA_API_URL = process.env.ABCA_API_URL;
const ABCA_API_KEY = process.env.ABCA_API_KEY;

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("task_id");

  if (!taskId) {
    return NextResponse.json({ error: "task_id is required" }, { status: 400 });
  }

  if (!ABCA_API_URL) {
    // Return mock events
    return NextResponse.json([
      { event_id: "e-1", task_id: taskId, event_type: "TASK_SUBMITTED", timestamp: new Date(Date.now() - 270000).toISOString(), payload: {}, message: "Task submitted" },
      { event_id: "e-2", task_id: taskId, event_type: "HYDRATION_STARTED", timestamp: new Date(Date.now() - 265000).toISOString(), payload: {}, message: "Loading context and memory" },
      { event_id: "e-3", task_id: taskId, event_type: "HYDRATION_COMPLETE", timestamp: new Date(Date.now() - 260000).toISOString(), payload: {}, message: "Context loaded: 3 prior episodes, repo structure analyzed" },
      { event_id: "e-4", task_id: taskId, event_type: "EXECUTION_STARTED", timestamp: new Date(Date.now() - 255000).toISOString(), payload: {}, message: "Agent execution started in MicroVM" },
      { event_id: "e-5", task_id: taskId, event_type: "TOOL_USE", timestamp: new Date(Date.now() - 240000).toISOString(), payload: { tool: "filesystem", action: "read" }, message: "Reading repository structure" },
      { event_id: "e-6", task_id: taskId, event_type: "TOOL_USE", timestamp: new Date(Date.now() - 200000).toISOString(), payload: { tool: "filesystem", action: "write" }, message: "Writing implementation files" },
      { event_id: "e-7", task_id: taskId, event_type: "TOOL_USE", timestamp: new Date(Date.now() - 150000).toISOString(), payload: { tool: "shell", action: "exec" }, message: "Running tests: 12 passed" },
      { event_id: "e-8", task_id: taskId, event_type: "TOOL_USE", timestamp: new Date(Date.now() - 100000).toISOString(), payload: { tool: "github", action: "create_pr" }, message: "Creating pull request" },
      { event_id: "e-9", task_id: taskId, event_type: "TASK_COMPLETED", timestamp: new Date(Date.now() - 80000).toISOString(), payload: { pr_url: "https://github.com/tinder/backend-api/pull/142" }, message: "Task completed successfully" },
    ]);
  }

  try {
    const res = await fetch(`${ABCA_API_URL}/tasks/${taskId}/events`, {
      headers: {
        ...(ABCA_API_KEY ? { "x-api-key": ABCA_API_KEY } : {}),
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch events from ABCA" }, { status: 502 });
  }
}
