import { NextRequest, NextResponse } from "next/server";
import type { WorkflowState, WorkflowInput, RepoConfig } from "@/lib/workflow/types";

// In-memory storage for demo purposes
// In production, this would be backed by DynamoDB or another persistent store
const workflowStore = new Map<string, WorkflowState>();

// Generate a unique workflow ID
function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `wf_${timestamp}_${random}`;
}

// Generate a unique epic ID
function generateEpicId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `EPIC-${num}`;
}

// GET /api/workflows - List all workflows
// POST /api/workflows - Create a new workflow
export async function GET() {
  try {
    const workflows = Array.from(workflowStore.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("Error listing workflows:", error);
    return NextResponse.json(
      { error: "Failed to list workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, repoConfig, sources } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const workflowId = generateWorkflowId();
    const epicId = generateEpicId();
    const now = new Date().toISOString();

    const input: WorkflowInput = {
      title,
      description,
      repoConfig: repoConfig || { layout: "monorepo", repos: [] },
      sources: sources || [],
    };

    const workflow: WorkflowState = {
      id: workflowId,
      phase: "intake",
      epicId,
      repoConfig: input.repoConfig,
      input,
      agentTasks: {},
      messages: [],
      humanNotifications: [
        {
          id: `notif_${Date.now()}`,
          type: "phase_complete",
          title: "Workflow Started",
          details: `Workflow "${title}" has been created and is now in the intake phase.`,
          timestamp: now,
          acknowledged: false,
        },
      ],
      startedAt: now,
    };

    workflowStore.set(workflowId, workflow);

    // Simulate workflow progression (in production, this would be handled by the orchestrator)
    simulateWorkflowProgression(workflowId);

    return NextResponse.json({ id: workflowId, epicId });
  } catch (error) {
    console.error("Error creating workflow:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}

// Simulate workflow progression for demo purposes
async function simulateWorkflowProgression(workflowId: string) {
  const workflow = workflowStore.get(workflowId);
  if (!workflow) return;

  const phases: Array<{
    phase: WorkflowState["phase"];
    delay: number;
    agents?: string[];
  }> = [
    { phase: "requirements", delay: 2000, agents: ["team-requirements-analyst"] },
    { phase: "design", delay: 3000, agents: ["team-ios-designer", "team-backend-designer"] },
    { phase: "development", delay: 4000, agents: ["team-frontend-dev", "team-backend-dev"] },
    { phase: "review", delay: 2000, agents: ["team-security-reviewer"] },
    { phase: "complete", delay: 1000 },
  ];

  for (const { phase, delay, agents } of phases) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    const current = workflowStore.get(workflowId);
    if (!current || current.phase === "error") break;

    // Add agent tasks for this phase
    if (agents) {
      const now = new Date().toISOString();
      for (const agentId of agents) {
        current.agentTasks[agentId] = {
          id: `task_${Date.now()}_${agentId}`,
          agentId,
          ticketId: `${current.epicId}-${Object.keys(current.agentTasks).length + 1}`,
          status: "running",
          input: `Process ${phase} phase for: ${current.input.title}`,
          startedAt: now,
        };
      }
    }

    // Update phase
    current.phase = phase;

    // Add notification
    current.humanNotifications.push({
      id: `notif_${Date.now()}`,
      type: phase === "complete" ? "phase_complete" : "phase_complete",
      title: `Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}`,
      details: phase === "complete"
        ? `Workflow "${current.input.title}" has completed successfully.`
        : `Workflow has entered the ${phase} phase.`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });

    // Mark previous phase agents as complete
    for (const task of Object.values(current.agentTasks)) {
      if (task.status === "running") {
        task.status = "complete";
        task.completedAt = new Date().toISOString();
        task.output = `Completed ${phase} phase work for ${current.input.title}`;
        
        // Add branch for dev agents
        if (task.agentId.includes("dev")) {
          task.branch = `feature/${current.epicId.toLowerCase()}-${task.agentId.replace("team-", "")}`;
          task.commitSha = Math.random().toString(36).substring(2, 10);
        }
      }
    }

    if (phase === "complete") {
      current.completedAt = new Date().toISOString();
    }

    workflowStore.set(workflowId, current);
  }
}

// Export the store for use by other routes
export { workflowStore };
