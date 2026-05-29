import { NextRequest, NextResponse } from "next/server";

// Shared in-memory store reference
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

export async function POST(request: NextRequest) {
  ensureInitialized();

  const body = await request.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "'enabled' must be a boolean" },
      { status: 400 }
    );
  }

  // Toggle all agents
  for (const [agentId, config] of agentStore.entries()) {
    config.enabled = enabled;
    agentStore.set(agentId, config);
  }

  return NextResponse.json({
    enabled,
    agentsUpdated: agentStore.size,
  });
}
