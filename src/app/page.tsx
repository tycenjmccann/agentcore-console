"use client";

import { useState, useEffect } from "react";
import {
  Bot, Brain, Cpu, Activity, ArrowRight, MessageSquare,
  Zap, Clock, Ticket, Layers, CheckCircle2,
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
  return {
    usage: {
      totalSessions: 847,
      totalTokensIn: 2_340_000,
      totalTokensOut: 1_870_000,
      avgSessionDuration: 94, // seconds
      totalDuration: 79_518, // seconds (all sessions combined)
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
      totalDuration: Math.floor(Math.random() * 20000) + 2000,
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
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
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
      {/* Agent Activity Section */}
      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Agent Activity</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <BigMetric
            label="Sessions"
            value={loading ? "—" : metrics.usage.totalSessions.toString()}
            sub={`${metrics.usage.sessionsToday} today · ${metrics.usage.sessionsThisWeek} this week`}
            icon={MessageSquare}
            color="text-brand-400"
          />
          <BigMetric
            label="Tokens"
            value={loading ? "—" : `${formatNumber(metrics.usage.totalTokensIn)} / ${formatNumber(metrics.usage.totalTokensOut)}`}
            sub="in / out"
            icon={Zap}
            color="text-cyan-400"
          />
          <BigMetric
            label="Avg Duration"
            value={loading ? "—" : formatDuration(metrics.usage.avgSessionDuration)}
            sub="per session"
            icon={Timer}
            color="text-yellow-400"
          />
          <BigMetric
            label="Total Duration"
            value={loading ? "—" : formatDuration(metrics.usage.totalDuration)}
            sub="autonomous work time"
            icon={Clock}
            color="text-emerald-400"
          />
          <BigMetric
            label="Active Agents"
            value={loading ? "—" : agents.filter((a) => a.status === "ACTIVE" || a.status === "READY").length.toString()}
            sub={`of ${agents.length} total`}
            icon={Bot}
            color="text-brand-400"
          />
        </div>
      </div>

      {/* Jira Section */}
      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Jira</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <BigMetric
            label="Tickets Resolved"
            value={loading ? "—" : metrics.productivity.ticketsResolved.toString()}
            sub={`${metrics.productivity.ticketsInProgress} in progress`}
            icon={CheckCircle2}
            color="text-green-400"
          />
          <BigMetric
            label="Active Epics"
            value={loading ? "—" : metrics.productivity.epicsActive.toString()}
            sub="in progress"
            icon={Layers}
            color="text-orange-400"
          />
          <BigMetric
            label="Stories Done"
            value={loading ? "—" : metrics.productivity.storiesCompleted.toString()}
            sub={`${metrics.productivity.storiesInProgress} active`}
            icon={Ticket}
            color="text-blue-400"
          />
          <BigMetric
            label="Avg Resolution"
            value={loading ? "—" : `${metrics.productivity.avgResolutionTime}m`}
            sub="per ticket"
            icon={Timer}
            color="text-emerald-400"
          />
          <BigMetric
            label="Throughput"
            value={loading ? "—" : `${Math.round(metrics.productivity.ticketsResolved / 7)}/day`}
            sub="avg this week"
            icon={TrendingUp}
            color="text-purple-400"
          />
          <BigMetric
            label="Automation Rate"
            value={loading ? "—" : "92%"}
            sub="no human needed"
            icon={Activity}
            color="text-brand-400"
          />
        </div>

        {/* Epics breakdown */}
        <div className="mt-5 pt-4 border-t border-surface-4">
          <p className="text-xs text-gray-500 mb-3">Epic Progress</p>
          <div className="space-y-2.5">
            {[
              { epic: "Customer Onboarding Automation", stories: 12, done: 9, color: "bg-orange-500" },
              { epic: "Support Ticket Resolution", stories: 24, done: 21, color: "bg-blue-500" },
              { epic: "Account Migration", stories: 8, done: 3, color: "bg-purple-500" },
              { epic: "Billing Dispute Handling", stories: 15, done: 14, color: "bg-green-500" },
              { epic: "Data Cleanup Sprint", stories: 30, done: 28, color: "bg-cyan-500" },
            ].map((e) => (
              <div key={e.epic} className="flex items-center gap-3">
                <span className="text-xs text-gray-300 w-56 truncate flex-shrink-0">{e.epic}</span>
                <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${e.color} rounded-full`}
                    style={{ width: `${(e.done / e.stories) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 w-16 text-right flex-shrink-0">{e.done}/{e.stories}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent Performance</h3>
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-4">
                  <th className="text-left py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Agent</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Sessions</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Tokens (in/out)</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Tickets</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Avg Duration</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Duration</th>
                  <th className="text-right py-3 px-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, idx) => {
                  const am = metrics.agentMetrics[idx];
                  return (
                    <tr key={agent.id} className="border-b border-surface-4/50 hover:bg-surface-3/30 transition-colors">
                      <td className="py-4 px-3">
                        <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 hover:text-white">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            agent.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20"
                          }`}>
                            {agent.type === "harness" ? (
                              <Brain className="w-4 h-4 text-brand-400" />
                            ) : (
                              <Cpu className="w-4 h-4 text-purple-400" />
                            )}
                          </div>
                          <span className="text-sm text-gray-200 font-semibold truncate max-w-[200px]">{agent.name}</span>
                        </Link>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-lg font-bold text-white">{am?.sessions || 0}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-base font-semibold text-cyan-300">{formatNumber(am?.tokensIn || 0)}</span>
                        <span className="text-gray-600 mx-1.5">|</span>
                        <span className="text-base font-semibold text-purple-300">{formatNumber(am?.tokensOut || 0)}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-lg font-bold text-green-400">{am?.ticketsResolved || 0}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-base font-semibold text-gray-200">{formatDuration(am?.avgDuration || 0)}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-lg font-bold text-emerald-300">{formatDuration(am?.totalDuration || 0)}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className={`px-2 py-1 rounded-full border text-xs font-medium ${
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
    </div>
  );
}

function BigMetric({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: string;
  icon: typeof Bot;
  color: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={`w-5 h-5 ${color} opacity-60 mt-1 flex-shrink-0`} />
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
