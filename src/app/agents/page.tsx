"use client";

import { useState, useEffect } from "react";
import { Bot, Brain, Cpu, Loader2 } from "lucide-react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  arn: string;
  type: "harness" | "runtime";
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agentcore/agents")
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Discovering agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Agents</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} discovered in your account
          </p>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="card text-center py-12">
          <Bot className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No agents found.</p>
          <p className="text-xs text-gray-600 mt-1">
            Deploy a harness or runtime to Bedrock AgentCore, then refresh.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="card hover:border-brand-600/40 transition-colors group"
              data-testid={`agent-card-${agent.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  agent.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20"
                }`}>
                  {agent.type === "harness" ? (
                    <Brain className="w-5 h-5 text-brand-400" />
                  ) : (
                    <Cpu className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                    {agent.name}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono truncate mt-0.5">{agent.id}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  agent.type === "harness"
                    ? "bg-brand-600/10 text-brand-400 border-brand-600/30"
                    : "bg-purple-600/10 text-purple-400 border-purple-600/30"
                }`}>
                  {agent.type.toUpperCase()}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  agent.status === "ACTIVE" || agent.status === "READY"
                    ? "bg-green-400/10 text-green-400 border-green-400/30"
                    : "bg-gray-400/10 text-gray-400 border-gray-400/30"
                }`}>
                  {agent.status}
                </span>
              </div>

              {agent.updatedAt && (
                <p className="text-[10px] text-gray-600 mt-2">
                  Updated {new Date(agent.updatedAt).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
