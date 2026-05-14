"use client";

import { useState, useEffect } from "react";
import {
  Bot, Brain, Cpu, Activity, ArrowRight, MessageSquare,
  Zap, Clock, BarChart3, Ticket, Layers, CheckCircle2,
  TrendingUp, Timer,
} from "lucide-react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  type: "harness" | "runtime";
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

// Mock metrics — will be replaced with real API calls (AgentCore Memory + Jira)
function useDashboardMetrics(agents: Agent[]) {
  // In production these would come from:
  // - AgentCore Memory API (sessions, events) → session count, token usage, duration
  // - Jira API → epics, stories, tickets
  // - CloudWatch Metrics → invocation counts, latency
  return {
    usage: {
      totalSessions: 847,
      totalTokensIn: 2_340_000,
      totalTokensOut: 1_870_000,
      avgSessionDuration: 94, // seconds
      sessionsToday: 63,
      sessionsThisWeek: 312,
    },
    productivity: {
      ticketsResolved: 234,
      ticketsInProgress: 18,
      epicsActive: 5,
      storiesCompleted: 89,
      storiesInProgress: 12,
      avgResolutionTime: 4.2, // minutes
    },
    agentMetrics: agents.map((a) => ({
      id: a.id,
      sessions: Math.floor(Math.random() * 200) + 20,
      tokensIn: Math.floor(Math.random() * 500000) + 50000,
      tokensOut: Math.floor(Math.random() * 400000) + 40000,
      ticketsResolved: Math.floor(Math.random() * 60) + 5,
      avgDuration: Math.floor(Math.random() * 120) + 30,
    })),
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
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

  const metrics = useDashboardMetrics(agents);

  return (
    <div className="space-y-6">
      {/* Usage Stats Row */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Usage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Total Sessions"
            value={loading ? "—" : metrics.usage.totalSessions.toString()}
            icon={MessageSquare}
            color="text-brand-400"
            sub={`${metrics.usage.sessionsToday} today`}
          />
          <MetricCard
            label="Tokens In"
            value={loading ? "—" : formatNumber(metrics.usage.totalTokensIn)}
            icon={Zap}
            color="text-cyan-400"
            sub="input"
          />
          <MetricCard
            label="Tokens Out"
            value={loading ? "—" : formatNumber(metrics.usage.totalTokensOut)}
            icon={Zap}
            color="text-purple-400"
            sub="output"
          />
          <MetricCard
            label="Avg Duration"
            value={loading ? "—" : formatDuration(metrics.usage.avgSessionDuration)}
            icon={Timer}
            color="text-yellow-400"
            sub="per session"
          />
          <MetricCard
            label="This Week"
            value={loading ? "—" : metrics.usage.sessionsThisWeek.toString()}
            icon={BarChart3}
            color="text-green-400"
            sub="sessions"
          />
          <MetricCard
            label="Active Agents"
            value={loading ? "—" : agents.filter((a) => a.status === "ACTIVE" || a.status === "READY").length.toString()}
            icon={Bot}
            color="text-brand-400"
            sub={`of ${agents.length} total`}
          />
        </div>
      </div>

      {/* Productivity Stats Row */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Productivity</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Tickets Resolved"
            value={loading ? "—" : metrics.productivity.ticketsResolved.toString()}
            icon={CheckCircle2}
            color="text-green-400"
            sub={`${metrics.productivity.ticketsInProgress} in progress`}
          />
          <MetricCard
            label="Active Epics"
            value={loading ? "—" : metrics.productivity.epicsActive.toString()}
            icon={Layers}
            color="text-orange-400"
            sub="in progress"
          />
          <MetricCard
            label="Stories Done"
            value={loading ? "—" : metrics.productivity.storiesCompleted.toString()}
            icon={Ticket}
            color="text-blue-400"
            sub={`${metrics.productivity.storiesInProgress} active`}
          />
          <MetricCard
            label="Avg Resolution"
            value={loading ? "—" : `${metrics.productivity.avgResolutionTime}m`}
            icon={Clock}
            color="text-emerald-400"
            sub="per ticket"
          />
          <MetricCard
            label="Throughput"
            value={loading ? "—" : `${Math.round(metrics.productivity.ticketsResolved / 7)}/day`}
            icon={TrendingUp}
            color="text-purple-400"
            sub="avg this week"
          />
          <MetricCard
            label="Automation Rate"
            value={loading ? "—" : "92%"}
            icon={Activity}
            color="text-brand-400"
            sub="resolved without human"
          />
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Agent Performance</h3>
          <Link href="/agents" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-4">Discovering agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No agents found. Ensure your AWS credentials have access to Bedrock AgentCore.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-4">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Agent</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Sessions</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Tokens In</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Tokens Out</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Tickets</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Avg Duration</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, idx) => {
                  const am = metrics.agentMetrics[idx];
                  return (
                    <tr key={agent.id} className="border-b border-surface-4/50 hover:bg-surface-3/30 transition-colors">
                      <td className="py-2.5 px-2">
                        <Link href={`/agents/${agent.id}`} className="flex items-center gap-2 hover:text-white">
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${
                            agent.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20"
                          }`}>
                            {agent.type === "harness" ? (
                              <Brain className="w-3 h-3 text-brand-400" />
                            ) : (
                              <Cpu className="w-3 h-3 text-purple-400" />
                            )}
                          </div>
                          <span className="text-gray-300 font-medium truncate max-w-[180px]">{agent.name}</span>
                        </Link>
                      </td>
                      <td className="text-right py-2.5 px-2 text-gray-400">{am?.sessions || 0}</td>
                      <td className="text-right py-2.5 px-2 text-gray-400">{formatNumber(am?.tokensIn || 0)}</td>
                      <td className="text-right py-2.5 px-2 text-gray-400">{formatNumber(am?.tokensOut || 0)}</td>
                      <td className="text-right py-2.5 px-2 text-gray-400">{am?.ticketsResolved || 0}</td>
                      <td className="text-right py-2.5 px-2 text-gray-400">{formatDuration(am?.avgDuration || 0)}</td>
                      <td className="text-right py-2.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${
                          agent.status === "ACTIVE" || agent.status === "READY"
                            ? "bg-green-400/10 text-green-400 border-green-400/30"
                            : "bg-gray-400/10 text-gray-400 border-gray-400/30"
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Jira Overview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-400" />
            Jira — Ticket Pipeline
          </h3>
          <div className="space-y-3">
            <PipelineBar label="Backlog" count={42} total={306} color="bg-gray-500" />
            <PipelineBar label="In Progress" count={18} total={306} color="bg-blue-500" />
            <PipelineBar label="In Review" count={12} total={306} color="bg-yellow-500" />
            <PipelineBar label="Done" count={234} total={306} color="bg-green-500" />
          </div>
          <p className="text-[10px] text-gray-600 mt-3">Source: Jira API — project tickets assigned to agents</p>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" />
            Jira — Epics & Stories
          </h3>
          <div className="space-y-2">
            {[
              { epic: "Customer Onboarding Automation", stories: 12, done: 9, color: "text-orange-400" },
              { epic: "Support Ticket Resolution", stories: 24, done: 21, color: "text-blue-400" },
              { epic: "Account Migration", stories: 8, done: 3, color: "text-purple-400" },
              { epic: "Billing Dispute Handling", stories: 15, done: 14, color: "text-green-400" },
              { epic: "Data Cleanup Sprint", stories: 30, done: 28, color: "text-cyan-400" },
            ].map((e) => (
              <div key={e.epic} className="flex items-center justify-between py-1.5 border-b border-surface-4/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className={`w-3 h-3 flex-shrink-0 ${e.color}`} />
                  <span className="text-xs text-gray-300 truncate">{e.epic}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-[10px] text-gray-500">{e.done}/{e.stories} stories</span>
                  <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(e.done / e.stories) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-3">Source: Jira API — epics with agent-assigned stories</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: string;
  icon: typeof Bot;
  color: string;
  sub?: string;
}) {
  return (
    <div className="card !py-3 !px-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-white mt-0.5">{value}</p>
          {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
        </div>
        <Icon className={`w-5 h-5 ${color} opacity-40`} />
      </div>
    </div>
  );
}

function PipelineBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-gray-500">{count} ({pct}%)</span>
      </div>
      <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
