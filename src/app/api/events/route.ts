import { NextResponse } from "next/server";

export interface ActivityEvent {
  id: string;
  type: "success" | "error" | "info" | "warning";
  description: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  workflowId?: string;
  workflowName?: string;
}

// Generate mock events for initial development
function generateMockEvents(): ActivityEvent[] {
  const now = Date.now();
  const events: ActivityEvent[] = [
    {
      id: "evt-001",
      type: "success",
      description: "Agent completed ticket TEAM-412 successfully",
      timestamp: new Date(now - 30000).toISOString(),
      agentId: "agent-frontend-dev",
      agentName: "Frontend Dev",
    },
    {
      id: "evt-002",
      type: "info",
      description: "Workflow 'Customer Onboarding' started",
      timestamp: new Date(now - 60000).toISOString(),
      workflowId: "wf-onboarding-001",
      workflowName: "Customer Onboarding",
    },
    {
      id: "evt-003",
      type: "warning",
      description: "Agent approaching token limit (85% used)",
      timestamp: new Date(now - 120000).toISOString(),
      agentId: "agent-backend-dev",
      agentName: "Backend Dev",
    },
    {
      id: "evt-004",
      type: "error",
      description: "Agent failed to process ticket TEAM-398: timeout exceeded",
      timestamp: new Date(now - 180000).toISOString(),
      agentId: "agent-qa-verifier",
      agentName: "QA Verifier",
    },
    {
      id: "evt-005",
      type: "success",
      description: "Workflow 'Data Migration' completed all phases",
      timestamp: new Date(now - 240000).toISOString(),
      workflowId: "wf-migration-002",
      workflowName: "Data Migration",
    },
    {
      id: "evt-006",
      type: "info",
      description: "Agent session started for code review task",
      timestamp: new Date(now - 300000).toISOString(),
      agentId: "agent-code-reviewer",
      agentName: "Code Reviewer",
    },
    {
      id: "evt-007",
      type: "success",
      description: "Pull request #142 merged by CI agent",
      timestamp: new Date(now - 360000).toISOString(),
      agentId: "agent-ci-agent",
      agentName: "CI Agent",
    },
    {
      id: "evt-008",
      type: "warning",
      description: "Rate limit warning: 3 retries on external API call",
      timestamp: new Date(now - 420000).toISOString(),
      agentId: "agent-backend-dev",
      agentName: "Backend Dev",
    },
    {
      id: "evt-009",
      type: "info",
      description: "Workflow 'Billing Dispute' entered review phase",
      timestamp: new Date(now - 480000).toISOString(),
      workflowId: "wf-billing-003",
      workflowName: "Billing Dispute",
    },
    {
      id: "evt-010",
      type: "success",
      description: "Agent resolved 5 support tickets in batch",
      timestamp: new Date(now - 540000).toISOString(),
      agentId: "agent-support",
      agentName: "Support Agent",
    },
    {
      id: "evt-011",
      type: "error",
      description: "Build failed: TypeScript compilation error in module",
      timestamp: new Date(now - 600000).toISOString(),
      agentId: "agent-ci-agent",
      agentName: "CI Agent",
    },
    {
      id: "evt-012",
      type: "success",
      description: "Agent deployed hotfix to staging environment",
      timestamp: new Date(now - 660000).toISOString(),
      agentId: "agent-devops",
      agentName: "DevOps Agent",
    },
    {
      id: "evt-013",
      type: "info",
      description: "New workflow created: 'Account Migration Sprint'",
      timestamp: new Date(now - 720000).toISOString(),
      workflowId: "wf-account-004",
      workflowName: "Account Migration Sprint",
    },
    {
      id: "evt-014",
      type: "warning",
      description: "Agent memory usage at 78% capacity",
      timestamp: new Date(now - 780000).toISOString(),
      agentId: "agent-frontend-dev",
      agentName: "Frontend Dev",
    },
    {
      id: "evt-015",
      type: "success",
      description: "All tests passing for feature branch feat/user-auth",
      timestamp: new Date(now - 840000).toISOString(),
      agentId: "agent-qa-verifier",
      agentName: "QA Verifier",
    },
  ];

  // Sort by timestamp ascending (newest at bottom)
  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export async function GET() {
  const events = generateMockEvents();

  // Limit to 50 events max
  const limited = events.slice(-50);

  return NextResponse.json(limited);
}
