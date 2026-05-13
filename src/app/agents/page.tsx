"use client";

import { Plus, Filter } from "lucide-react";
import AgentCard from "@/components/agents/AgentCard";
import { Agent } from "@/lib/types";

// This will be replaced with real ABCA API calls
const mockAgents: Agent[] = [
  {
    agent_id: "agent-backend-001",
    name: "Backend Agent",
    description: "Full-stack backend development, API design, database migrations",
    status: "ACTIVE",
    blueprint_id: "bp-backend",
    blueprint: {
      blueprint_id: "bp-backend",
      name: "Backend Blueprint",
      description: "Backend services development",
      tools: ["shell", "filesystem", "github", "web_search", "database"],
      mcp_servers: ["github-mcp", "postgres-mcp"],
      compute_type: "STANDARD",
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-10T00:00:00Z",
    },
    total_tasks: 47,
    successful_tasks: 44,
    failed_tasks: 3,
    last_invoked: new Date(Date.now() - 720000).toISOString(),
    created_at: "2026-04-15T00:00:00Z",
  },
  {
    agent_id: "agent-ios-001",
    name: "iOS Agent",
    description: "SwiftUI development, iOS features, XCTest integration",
    status: "ACTIVE",
    blueprint_id: "bp-ios",
    blueprint: {
      blueprint_id: "bp-ios",
      name: "iOS Blueprint",
      description: "iOS application development",
      tools: ["shell", "filesystem", "github", "xcode"],
      mcp_servers: ["github-mcp", "xcode-mcp"],
      compute_type: "LARGE",
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-10T00:00:00Z",
    },
    total_tasks: 31,
    successful_tasks: 28,
    failed_tasks: 3,
    last_invoked: new Date(Date.now() - 3600000).toISOString(),
    created_at: "2026-04-15T00:00:00Z",
  },
  {
    agent_id: "agent-android-001",
    name: "Android Agent",
    description: "Kotlin/Jetpack Compose, Android architecture components",
    status: "ACTIVE",
    blueprint_id: "bp-android",
    blueprint: {
      blueprint_id: "bp-android",
      name: "Android Blueprint",
      description: "Android application development",
      tools: ["shell", "filesystem", "github", "gradle"],
      mcp_servers: ["github-mcp"],
      compute_type: "STANDARD",
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-10T00:00:00Z",
    },
    total_tasks: 22,
    successful_tasks: 20,
    failed_tasks: 2,
    last_invoked: new Date(Date.now() - 7200000).toISOString(),
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    agent_id: "agent-security-001",
    name: "Security Agent",
    description: "Security reviews, vulnerability scanning, compliance checks",
    status: "ACTIVE",
    blueprint_id: "bp-security",
    blueprint: {
      blueprint_id: "bp-security",
      name: "Security Blueprint",
      description: "Security analysis and review",
      tools: ["shell", "filesystem", "github", "web_search"],
      mcp_servers: ["github-mcp", "snyk-mcp"],
      compute_type: "MICRO",
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-10T00:00:00Z",
    },
    total_tasks: 15,
    successful_tasks: 15,
    failed_tasks: 0,
    last_invoked: new Date(Date.now() - 1800000).toISOString(),
    created_at: "2026-04-20T00:00:00Z",
  },
  {
    agent_id: "agent-analytics-001",
    name: "Analytics Agent",
    description: "Event tracking implementation, analytics instrumentation",
    status: "INACTIVE",
    blueprint_id: "bp-analytics",
    blueprint: {
      blueprint_id: "bp-analytics",
      name: "Analytics Blueprint",
      description: "Analytics and tracking implementation",
      tools: ["shell", "filesystem", "github"],
      mcp_servers: ["github-mcp"],
      compute_type: "MICRO",
      created_at: "2026-05-05T00:00:00Z",
      updated_at: "2026-05-10T00:00:00Z",
    },
    total_tasks: 8,
    successful_tasks: 7,
    failed_tasks: 1,
    last_invoked: new Date(Date.now() - 86400000).toISOString(),
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    agent_id: "agent-localization-001",
    name: "Localization Agent",
    description: "i18n string extraction, translation management, locale testing",
    status: "INACTIVE",
    blueprint_id: "bp-l10n",
    blueprint: {
      blueprint_id: "bp-l10n",
      name: "Localization Blueprint",
      description: "Localization and internationalization",
      tools: ["shell", "filesystem", "github"],
      mcp_servers: ["github-mcp"],
      compute_type: "MICRO",
      created_at: "2026-05-05T00:00:00Z",
      updated_at: "2026-05-10T00:00:00Z",
    },
    total_tasks: 5,
    successful_tasks: 5,
    failed_tasks: 0,
    last_invoked: new Date(Date.now() - 172800000).toISOString(),
    created_at: "2026-05-01T00:00:00Z",
  },
];

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {mockAgents.length} agents configured
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm" data-testid="create-agent-btn">
            <Plus className="w-4 h-4" />
            New Agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {mockAgents.map((agent) => (
          <AgentCard key={agent.agent_id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
