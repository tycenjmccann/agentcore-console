"use client";

import { useState, useEffect } from "react";
import { Bot, Cpu, Brain, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  type: "harness" | "runtime";
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agentcore/agents")
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const harnesses = agents.filter((a) => a.type === "harness");
  const runtimes = agents.filter((a) => a.type === "runtime");
  const active = agents.filter((a) => a.status === "ACTIVE" || a.status === "READY");

  const stats = [
    { label: "Total Agents", value: agents.length.toString(), icon: Bot, color: "text-brand-400" },
    { label: "Harnesses", value: harnesses.length.toString(), icon: Brain, color: "text-purple-400" },
    { label: "Runtimes", value: runtimes.length.toString(), icon: Cpu, color: "text-cyan-400" },
    { label: "Active", value: active.length.toString(), icon: Activity, color: "text-green-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{loading ? "—" : stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color} opacity-50`} />
            </div>
          </div>
        ))}
      </div>

      {/* Agents List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Discovered Agents</h3>
          <Link href="/agents" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-4">Discovering agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No agents found. Ensure your AWS credentials have access to Bedrock AgentCore.</div>
        ) : (
          <div className="space-y-3">
            {agents.slice(0, 6).map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center justify-between py-2 border-b border-surface-4 last:border-0 hover:bg-surface-3/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    agent.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20"
                  }`}>
                    {agent.type === "harness" ? (
                      <Brain className="w-4 h-4 text-brand-400" />
                    ) : (
                      <Cpu className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-200">{agent.name}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{agent.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
