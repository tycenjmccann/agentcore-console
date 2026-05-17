import { NextRequest, NextResponse } from "next/server";
import type {
  WorkflowState,
  WorkflowInput,
  JiraTicket,
  WorkflowPhase,
} from "@/lib/workflow/types";

// In-memory storage (replace with S3/DynamoDB in production)
const workflows = new Map<string, WorkflowState>();
const tickets = new Map<string, JiraTicket>();

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// GET /api/workflow - List all workflows
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("id");

  if (workflowId) {
    // Get specific workflow
    const workflow = workflows.get(workflowId);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Include related tickets
    const workflowTickets = Array.from(tickets.values()).filter(
      (t) => t.id === workflow.epicId || t.parent === workflow.epicId
    );

    return NextResponse.json({
      workflow,
      tickets: workflowTickets,
    });
  }

  // List all workflows
  const allWorkflows = Array.from(workflows.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return NextResponse.json({ workflows: allWorkflows });
}

// POST /api/workflow - Create new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: WorkflowInput = body.input;

    if (!input || !input.title || !input.repoConfig) {
      return NextResponse.json(
        { error: "Invalid input: title and repoConfig required" },
        { status: 400 }
      );
    }

    const workflowId = generateId("wf");
    const epicId = generateId("TEAM");

    // Create epic ticket
    const epic: JiraTicket = {
      id: epicId,
      type: "epic",
      title: input.title,
      description: input.description,
      status: "backlog",
      children: [],
      blockedBy: [],
      comments: [],
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tickets.set(epicId, epic);

    // Create workflow
    const workflow: WorkflowState = {
      id: workflowId,
      phase: "intake",
      epicId,
      repoConfig: input.repoConfig,
      input,
      agentTasks: {},
      messages: [],
      humanNotifications: [],
      startedAt: new Date().toISOString(),
    };
    workflows.set(workflowId, workflow);

    return NextResponse.json({
      workflowId,
      epicId,
      workflow,
    });
  } catch (error) {
    console.error("Failed to create workflow:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}

// PATCH /api/workflow - Update workflow state
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, phase, agentTasks, error: workflowError } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "workflowId required" },
        { status: 400 }
      );
    }

    const workflow = workflows.get(workflowId);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Update workflow
    if (phase) workflow.phase = phase as WorkflowPhase;
    if (agentTasks) {
      workflow.agentTasks = { ...workflow.agentTasks, ...agentTasks };
    }
    if (workflowError) workflow.error = workflowError;
    if (phase === "complete" || phase === "error") {
      workflow.completedAt = new Date().toISOString();
    }

    workflows.set(workflowId, workflow);

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("Failed to update workflow:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}
