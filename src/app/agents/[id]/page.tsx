"use client";

import { ArrowLeft, Bot, GitPullRequest, Clock, Cpu, Server, Wrench } from "lucide-react";
import Link from "next/link";

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  // TODO: Fetch from real ABCA API using params.id
  const agent = {
    agent_id: params.id,
    name: "Backend Agent",
    description: "Full-stack backend development, API design, database migrations",
    status: "ACTIVE",
    blueprint: {
      name: "Backend Blueprint",
      compute_type: "STANDARD",
      tools: ["shell", "filesystem", "github", "web_search", "database"],
      mcp_servers: ["github-mcp", "postgres-mcp"],
    },
    total_tasks: 47,
    successful_tasks: 44,
    failed_tasks: 3,
    recent_tasks: [
      { id: "t-001", description: "Add user preferences API", status: "COMPLETED", time: "12m ago", pr_url: "https://github.com/org/repo/pull/142" },
      { id: "t-002", description: "Refactor auth middleware", status: "COMPLETED", time: "2h ago", pr_url: "https://github.com/org/repo/pull/141" },
      { id: "t-003", description: "Add rate limiting", status: "RUNNING", time: "5m ago", pr_url: null },
    ],
  };

  return (
    <div className="space-y-6">
      <Link href="/agents" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300">
        <ArrowLeft className="w-4 h-4" />
        Back to Agents
      </Link>

      {/* Agent Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-surface-3 rounded-xl flex items-center justify-center">
              <Bot className="w-7 h-7 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-running" />
            <span className="text-sm text-green-400">{agent.status}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-surface-3 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Tasks</p>
            <p className="text-lg font-bold text-white mt-1">{agent.total_tasks}</p>
          </div>
          <div className="bg-surface-3 rounded-lg p-3">
            <p className="text-xs text-gray-500">Success Rate</p>
            <p className="text-lg font-bold text-green-400 mt-1">
              {Math.round((agent.successful_tasks / agent.total_tasks) * 100)}%
            </p>
          </div>
          <div className="bg-surface-3 rounded-lg p-3">
            <p className="text-xs text-gray-500">Compute Type</p>
            <p className="text-lg font-bold text-white mt-1">{agent.blueprint.compute_type}</p>
          </div>
          <div className="bg-surface-3 rounded-lg p-3">
            <p className="text-xs text-gray-500">MCP Servers</p>
            <p className="text-lg font-bold text-white mt-1">{agent.blueprint.mcp_servers.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Blueprint Config */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Blueprint Configuration
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.blueprint.tools.map((tool) => (
                  <span key={tool} className="text-xs px-2 py-1 bg-surface-3 rounded-md text-gray-300 border border-surface-4">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">MCP Servers</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.blueprint.mcp_servers.map((server) => (
                  <span key={server} className="text-xs px-2 py-1 bg-brand-600/10 rounded-md text-brand-400 border border-brand-600/20">
                    <Server className="w-3 h-3 inline mr-1" />
                    {server}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <GitPullRequest className="w-4 h-4" />
            Recent Tasks
          </h3>
          <div className="space-y-3">
            {agent.recent_tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-surface-4 last:border-0">
                <div>
                  <p className="text-sm text-gray-300">{task.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-600">{task.time}</span>
                    {task.pr_url && (
                      <a href={task.pr_url} className="text-xs text-brand-400 hover:underline">
                        View PR
                      </a>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  task.status === "COMPLETED" ? "bg-green-400/10 text-green-400 border-green-400/30" :
                  task.status === "RUNNING" ? "bg-blue-400/10 text-blue-400 border-blue-400/30" :
                  "bg-gray-400/10 text-gray-400 border-gray-400/30"
                }`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
