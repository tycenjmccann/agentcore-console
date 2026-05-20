import { NextRequest } from "next/server";

/**
 * Activity event schema returned by this endpoint.
 */
export interface ActivityEvent {
  id: string;
  type: "success" | "error" | "info" | "warning";
  description: string;
  timestamp: string; // ISO 8601
  agentId?: string;
  agentName?: string;
  workflowId?: string;
  workflowName?: string;
}

/**
 * Generate mock events for demonstration purposes.
 * In production, this would query a real event store.
 */
function generateMockEvents(): ActivityEvent[] {
  const now = Date.now();
  const events: ActivityEvent[] = [
    {
      id: "evt-001",
      type: "success",
      description: "Agent completed ticket resolution",
      timestamp: new Date(now - 30_000).toISOString(),
      agentId: "agent-frontend-dev",
      agentName: "Frontend Dev",
    },
    {
      id: "evt-002",
      type: "info",
      description: "Workflow started: Customer Onboarding",
      timestamp: new Date(now - 120_000).toISOString(),
      workflowId: "wf-onboarding-001",
      workflowName: "Customer Onboarding",
    },
    {
      id: "evt-003",
      type: "warning",
      description: "Agent response time exceeded threshold (45s)",
      timestamp: new Date(now - 180_000).toISOString(),
      agentId: "agent-backend-dev",
      agentName: "Backend Dev",
    },
    {
      id: "evt-004",
      type: "error",
      description: "Workflow failed: Build validation error in CI pipeline",
      timestamp: new Date(now - 300_000).toISOString(),
      workflowId: "wf-ci-pipeline-002",
      workflowName: "CI Pipeline",
    },
    {
      id: "evt-005",
      type: "success",
      description: "Agent deployed successfully to production",
      timestamp: new Date(now - 420_000).toISOString(),
      agentId: "agent-deployer",
      agentName: "Deployer Agent",
    },
    {
      id: "evt-006",
      type: "info",
      description: "New agent registered: QA Verifier",
      timestamp: new Date(now - 600_000).toISOString(),
      agentId: "agent-qa-verifier",
      agentName: "QA Verifier",
    },
    {
      id: "evt-007",
      type: "success",
      description: "Workflow completed: Data Migration Sprint",
      timestamp: new Date(now - 900_000).toISOString(),
      workflowId: "wf-data-migration-003",
      workflowName: "Data Migration Sprint",
    },
    {
      id: "evt-008",
      type: "warning",
      description: "Token usage approaching daily limit (85%)",
      timestamp: new Date(now - 1_200_000).toISOString(),
      agentId: "agent-content-writer",
      agentName: "Content Writer",
    },
    {
      id: "evt-009",
      type: "error",
      description: "Agent invocation failed: timeout after 120s",
      timestamp: new Date(now - 1_500_000).toISOString(),
      agentId: "agent-researcher",
      agentName: "Researcher Agent",
    },
    {
      id: "evt-010",
      type: "success",
      description: "Pull request merged by code review agent",
      timestamp: new Date(now - 1_800_000).toISOString(),
      agentId: "agent-code-reviewer",
      agentName: "Code Reviewer",
    },
    {
      id: "evt-011",
      type: "info",
      description: "Workflow queued: Billing Dispute Resolution",
      timestamp: new Date(now - 2_100_000).toISOString(),
      workflowId: "wf-billing-004",
      workflowName: "Billing Dispute Resolution",
    },
    {
      id: "evt-012",
      type: "success",
      description: "Agent completed 15 tickets in batch processing",
      timestamp: new Date(now - 2_400_000).toISOString(),
      agentId: "agent-batch-processor",
      agentName: "Batch Processor",
    },
    {
      id: "evt-013",
      type: "warning",
      description: "Memory store approaching capacity (92% used)",
      timestamp: new Date(now - 3_000_000).toISOString(),
      agentId: "agent-memory-manager",
      agentName: "Memory Manager",
    },
    {
      id: "evt-014",
      type: "info",
      description: "Agent configuration updated: new model routing",
      timestamp: new Date(now - 3_600_000).toISOString(),
      agentId: "agent-router",
      agentName: "Router Agent",
    },
    {
      id: "evt-015",
      type: "success",
      description: "Workflow completed: Account Migration batch 7",
      timestamp: new Date(now - 4_200_000).toISOString(),
      workflowId: "wf-account-migration-005",
      workflowName: "Account Migration",
    },
  ];

  // Sort ascending by timestamp (oldest first, newest at bottom)
  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * GET /api/events
 * Returns up to 50 activity events sorted by timestamp ascending.
 */
export async function GET(_req: NextRequest) {
  try {
    const events = generateMockEvents();
    // Limit to 50 events max
    const limited = events.slice(-50);
    return Response.json(limited);
  } catch (error) {
    console.error("Events API error:", error);
    return Response.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
