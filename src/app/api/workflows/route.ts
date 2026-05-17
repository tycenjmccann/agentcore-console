import { NextRequest, NextResponse } from "next/server";
import { WorkflowState, WorkflowPhase, JiraTicket } from "@/lib/workflow/types";

// In-memory workflow storage (replace with DynamoDB in production)
const workflows = new Map<string, WorkflowState>();

// Mock workflow data for development
function seedWorkflows() {
  if (workflows.size === 0) {
    const mockWorkflow: WorkflowState = {
      id: "wf_1778997791713_48ltk8",
      phase: "development",
      epicId: "TEAM-1",
      repoConfig: {
        layout: "monorepo",
        repos: [
          {
            url: "https://github.com/tycenjmccann/agentcore-console",
            defaultBranch: "main",
            platform: "shared"
          }
        ]
      },
      input: {
        title: "Implement Workflow Management UI",
        description: "Create a comprehensive workflow management interface for the AgentCore console",
        repoConfig: {
          layout: "monorepo",
          repos: [
            {
              url: "https://github.com/tycenjmccann/agentcore-console",
              defaultBranch: "main",
              platform: "shared"
            }
          ]
        },
        sources: []
      },
      agentTasks: {
        "team-requirements-analyst": {
          id: "task-1",
          agentId: "team-requirements-analyst",
          ticketId: "TEAM-58",
          status: "complete",
          input: "Analyze workflow requirements",
          output: "Requirements documented",
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3000000).toISOString()
        },
        "team-frontend-dev": {
          id: "task-2",
          agentId: "team-frontend-dev",
          ticketId: "TEAM-59",
          status: "running",
          input: "Implement frontend for workflow management",
          branch: "feature/TEAM-59-frontend-dev",
          startedAt: new Date(Date.now() - 1800000).toISOString()
        }
      },
      messages: [],
      humanNotifications: [],
      startedAt: new Date(Date.now() - 7200000).toISOString()
    };
    workflows.set(mockWorkflow.id, mockWorkflow);
  }
}

seedWorkflows();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const workflow = workflows.get(id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return NextResponse.json(workflow);
  }

  // List all workflows
  const allWorkflows = Array.from(workflows.values()).map(w => ({
    id: w.id,
    phase: w.phase,
    title: w.input.title,
    startedAt: w.startedAt,
    completedAt: w.completedAt,
    epicId: w.epicId
  }));

  return NextResponse.json({ workflows: allWorkflows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, repoConfig, sources } = body;

  if (!title || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const epicId = `TEAM-${workflows.size + 1}`;

  const workflow: WorkflowState = {
    id: workflowId,
    phase: "intake",
    epicId,
    repoConfig: repoConfig || {
      layout: "monorepo",
      repos: []
    },
    input: {
      title,
      description,
      repoConfig: repoConfig || { layout: "monorepo", repos: [] },
      sources: sources || []
    },
    agentTasks: {},
    messages: [],
    humanNotifications: [],
    startedAt: new Date().toISOString()
  };

  workflows.set(workflowId, workflow);

  return NextResponse.json({ workflow }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, phase, agentTask, notification } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing workflow ID" }, { status: 400 });
  }

  const workflow = workflows.get(id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (phase) {
    workflow.phase = phase;
  }

  if (agentTask) {
    workflow.agentTasks[agentTask.agentId] = agentTask;
  }

  if (notification) {
    workflow.humanNotifications.push(notification);
  }

  workflows.set(id, workflow);

  return NextResponse.json({ workflow });
}