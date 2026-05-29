import { NextRequest, NextResponse } from "next/server";

// Shared in-memory store reference (same module-level state as parent route)
// In production, this would read/write from DynamoDB
const agentStore = new Map<string, {
  enabled: boolean;
  sampleRate: number;
  batchSize: number;
  bufferCount: number;
}>();

const AGENT_CONFIGS = [
  { agentId: "team-pm", name: "Project Manager" },
  { agentId: "team-designer", name: "Designer" },
  { agentId: "team-frontend-dev", name: "Frontend Developer" },
  { agentId: "team-backend-dev", name: "Backend Developer" },
  { agentId: "team-ios-dev", name: "iOS Developer" },
  { agentId: "team-android-dev", name: "Android Developer" },
  { agentId: "team-qa-verifier", name: "QA Verifier" },
  { agentId: "team-ci-agent", name: "CI Agent" },
  { agentId: "team-devops", name: "DevOps Engineer" },
  { agentId: "team-data-eng", name: "Data Engineer" },
  { agentId: "team-ml-eng", name: "ML Engineer" },
  { agentId: "team-security", name: "Security Engineer" },
  { agentId: "team-tech-writer", name: "Technical Writer" },
  { agentId: "team-architect", name: "Solutions Architect" },
];

function ensureInitialized() {
  if (agentStore.size === 0) {
    for (const agent of AGENT_CONFIGS) {
      const hash = agent.agentId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      agentStore.set(agent.agentId, {
        enabled: hash % 3 !== 0,
        sampleRate: Math.min(100, Math.max(10, (hash % 90) + 10)),
        batchSize: Math.min(50, Math.max(5, (hash % 45) + 5)),
        bufferCount: Math.max(0, (hash % 20)),
      });
    }
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  ensureInitialized();
  const { agentId } = params;
  const config = agentStore.get(agentId);

  if (!config) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();

  // Apply updates
  if (typeof body.enabled === "boolean") {
    config.enabled = body.enabled;
  }
  if (typeof body.sampleRate === "number") {
    config.sampleRate = Math.max(0, Math.min(100, body.sampleRate));
  }
  if (typeof body.batchSize === "number") {
    config.batchSize = Math.max(1, Math.min(100, body.batchSize));
  }

  agentStore.set(agentId, config);

  return NextResponse.json({
    agentId,
    ...config,
  });
}
