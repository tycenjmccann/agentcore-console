import { NextResponse } from "next/server";
import type { WorkflowState, IntakeSource } from "@/lib/workflow/types";

/**
 * GET /api/workflow/state
 * Returns the current workflow state. In production this reads from DynamoDB/S3.
 * For now, returns a demo state to drive the pipeline visualization.
 */
export async function GET() {
  const demoState: WorkflowState = getDemoWorkflowState();
  return NextResponse.json(demoState);
}

/** Demo sources representing realistic intake artifacts */
const DEMO_SOURCES: IntakeSource[] = [
  {
    type: "s3",
    value: "s3://agentcore-artifacts-023392223961-us-east-1/workflows/wf_demo_001/shared/source-0-s3.md",
    contentType: "text/markdown",
    label: "PRD - Pipeline Visualization Feature",
  },
  {
    type: "s3",
    value: "s3://agentcore-artifacts-023392223961-us-east-1/workflows/wf_demo_001/shared/source-1-s3.md",
    contentType: "text/plain",
    label: "Current workflow page.tsx",
  },
  {
    type: "url",
    value: "https://www.figma.com/design/abc123/Pipeline-Visualization",
    label: "Figma Design - Pipeline Layout",
  },
  {
    type: "s3",
    value: "s3://agentcore-artifacts-023392223961-us-east-1/workflows/wf_demo_001/shared/source-2-s3.md",
    contentType: "text/plain",
    label: "WorkflowBoard.tsx",
  },
];

function getDemoWorkflowState(): WorkflowState {
  // Cycle through phases for demo purposes based on time
  const phases: WorkflowState["phase"][] = [
    "intake",
    "requirements",
    "design",
    "development",
    "review",
    "complete",
  ];

  // Each phase lasts 10 seconds in demo mode (60s full cycle)
  const cycleTime = 60_000;
  const elapsed = Date.now() % cycleTime;
  const phaseIdx = Math.min(
    Math.floor(elapsed / (cycleTime / phases.length)),
    phases.length - 1
  );
  const currentPhase = phases[phaseIdx];

  return {
    id: "wf_demo_001",
    phase: currentPhase,
    epicId: "TEAM-1",
    repoConfig: {
      layout: "monorepo",
      repos: [
        {
          url: "https://github.com/tycenjmccann/agentcore-console",
          defaultBranch: "main",
          platform: "shared",
        },
      ],
    },
    input: {
      title: "Pipeline Visualization Feature",
      description: "Replace WorkflowBoard with animated pipeline visualization",
      repoConfig: {
        layout: "monorepo",
        repos: [
          {
            url: "https://github.com/tycenjmccann/agentcore-console",
            defaultBranch: "main",
            platform: "shared",
          },
        ],
      },
      sources: DEMO_SOURCES,
    },
    agentTasks: buildDemoAgentTasks(currentPhase),
    messages: [],
    humanNotifications: [],
    startedAt: new Date(Date.now() - elapsed).toISOString(),
    completedAt: currentPhase === "complete" ? new Date().toISOString() : undefined,
    featureBranch: "feature/TEAM-159-frontend-dev",
  };
}

function buildDemoAgentTasks(
  phase: WorkflowState["phase"]
): WorkflowState["agentTasks"] {
  const tasks: WorkflowState["agentTasks"] = {};

  const designAgents = [
    "team-ios-designer",
    "team-android-designer",
    "team-backend-designer",
    "team-security-reviewer",
    "team-analytics-designer",
    "team-localization",
    "team-legal-compliance",
  ];

  const devAgents = ["team-frontend-dev", "team-backend-dev", "team-api-dev"];

  if (
    phase === "requirements" ||
    phase === "design" ||
    phase === "development" ||
    phase === "review" ||
    phase === "complete"
  ) {
    tasks["team-requirements"] = {
      id: "task-req-1",
      agentId: "team-requirements",
      ticketId: "TEAM-1",
      status: phase === "requirements" ? "running" : "complete",
      input: "Analyze PRD and create tickets",
      startedAt: new Date().toISOString(),
      completedAt: phase !== "requirements" ? new Date().toISOString() : undefined,
    };
  }

  if (
    phase === "design" ||
    phase === "development" ||
    phase === "review" ||
    phase === "complete"
  ) {
    designAgents.forEach((agentId, idx) => {
      tasks[agentId] = {
        id: `task-design-${idx}`,
        agentId,
        ticketId: `TEAM-${idx + 10}`,
        status: phase === "design" ? "running" : "complete",
        input: "Create design document",
        startedAt: new Date().toISOString(),
        completedAt: phase !== "design" ? new Date().toISOString() : undefined,
      };
    });
  }

  if (phase === "development" || phase === "review" || phase === "complete") {
    devAgents.forEach((agentId, idx) => {
      tasks[agentId] = {
        id: `task-dev-${idx}`,
        agentId,
        ticketId: `TEAM-${idx + 20}`,
        status: phase === "development" ? "running" : "complete",
        input: "Implement feature",
        branch: `feature/TEAM-${idx + 20}`,
        startedAt: new Date().toISOString(),
        completedAt: phase !== "development" ? new Date().toISOString() : undefined,
      };
    });
  }

  return tasks;
}
