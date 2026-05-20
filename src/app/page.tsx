"use client";

import { useState, useEffect } from "react";
import {
  Bot, Brain, Cpu, Activity, ArrowRight, MessageSquare,
  Zap, Clock, Ticket, Layers, CheckCircle2,
  TrendingUp, Timer,
} from "lucide-react";
import Link from "next/link";
import { cachedFetch, getCached } from "@/lib/client-cache";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Agent {
  id: string;
  name: string;
  type: "harness" | "runtime";
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MetricsData {
  usage: {
    totalSessions: number;
    totalTokensIn: number;
    totalTokensOut: number;
    avgSessionDuration: number;
    totalDuration: number;
    totalInvocations: number;
    activeAgents: number;
    totalAgents: number;
  };
  agentMetrics: Array<{
    id: string;
    name: string;
    sessions: number;
    tokensIn: number;
    tokensOut: number;
    avgDuration: number;
    totalDuration: number;
    invocations: number;
  }>;
}

const EPIC_COLORS = ["bg-orange-500", "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-cyan-500"];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function DashboardPage() {
  // Initialize from cache for instant render on back-navigation
  const [agents, setAgents] = useState<Agent[]>(() => getCached<Agent[]>("/api/agentcore/agents") || []);
  const [metrics, setMetrics] = useState<MetricsData | null>(() => getCached<MetricsData>("/api/agentcore/metrics"));
  const [loading, setLoading] = useState(!getCached("/api/agentcore/agents"));

  // Dashboard metrics from DynamoDB (tickets, epics, agent activity)
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError } = useDashboardMetrics();

  useEffect(() => {
    // Fetch with cache — returns instantly if cached, revalidates in background
    Promise.all([
      cachedFetch<Agent[]>("/api/agentcore/agents"),
      cachedFetch<MetricsData>("/api/agentcore/metrics"),
    ])
      .then(([agentsData, metricsData]) => {
        setAgents(Array.isArray(agentsData) ? agentsData : []);
        if (metricsData && !(metricsData as any).error) setMetrics(metricsData);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Agent Activity Section */}
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">Agent Activity</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <BigMetric
            label="Invocations"
            value={dashboardLoading ? "—" : (dashboardData?.agentActivity.invocations ?? 0).toString()}
            sub={`${dashboardData?.agentActivity.sessions ?? 0} sessions`}
            icon={MessageSquare}
            color="text-brand-400"
          />
          <BigMetric
            label="Tokens"
            value="—"
            valueTitle="Coming soon"
            sub="coming soon"
            icon={Zap}
            color="text-cyan-400"
          />
          <BigMetric
            label="Avg Duration"
            value={dashboardLoading ? "—" : formatDuration(dashboardData?.agentActivity.avgDuration ?? 0)}
            sub="per session"
            icon={Timer}
            color="text-yellow-400"
          />
          <BigMetric
            label="Total Duration"
            value={dashboardLoading ? "—" : formatDuration(dashboardData?.agentActivity.totalDuration ?? 0)}
            sub="autonomous work time"
            icon={Clock}
            color="text-emerald-400"
          />
          <BigMetric
            label="Active Agents"
            value={dashboardLoading ? "—" : (dashboardData?.agentActivity.activeAgents ?? 0).toString()}
            sub={`${dashboardData?.agentActivity.sessions ?? 0} sessions`}
            icon={Bot}
            color="text-brand-400"
          />
        </div>
      </div>

      {/* Jira Section */}
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">Jira</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <BigMetric
            label="Tickets Resolved"
            value={dashboardLoading ? "—" : (dashboardData?.tickets.resolved ?? 0).toString()}
            sub={`${dashboardData?.tickets.inProgress ?? 0} in progress`}
            icon={CheckCircle2}
            color="text-green-400"
          />
          <BigMetric
            label="Active Epics"
            value={dashboardLoading ? "—" : (dashboardData?.tickets.activeEpics ?? 0).toString()}
            sub="in progress"
            icon={Layers}
            color="text-orange-400"
          />
          <BigMetric
            label="Stories Done"
            value={dashboardLoading ? "—" : (dashboardData?.tickets.storiesDone ?? 0).toString()}
            sub={`${dashboardData?.tickets.storiesActive ?? 0} active`}
            icon={Ticket}
            color="text-blue-400"
          />
          <BigMetric
            label="Avg Resolution"
            value={dashboardLoading ? "—" : `${dashboardData?.tickets.avgResolutionMinutes ?? 0}m`}
            sub="per ticket"
            icon={Timer}
            color="text-emerald-400"
          />
          <BigMetric
            label="Throughput"
            value={dashboardLoading ? "—" : `${dashboardData?.tickets.throughputPerDay ?? 0}/day`}
            sub="avg this week"
            icon={TrendingUp}
            color="text-purple-400"
          />
          <BigMetric
            label="Automation Rate"
            value={dashboardLoading ? "—" : `${dashboardData?.tickets.automationRate ?? 0}%`}
            sub="no human needed"
            icon={Activity}
            color="text-brand-400"
          />
        </div>

        {/* Epics breakdown */}
        <div className="mt-5 pt-4 border-t border-surface-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-3">Epic Progress</p>
          <div className="space-y-2.5">
            {dashboardLoading ? (
              <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>
            ) : !dashboardData?.epics || dashboardData.epics.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No active epics</p>
            ) : (
              dashboardData.epics.map((epic, index) => (
                <div key={epic.workflowId} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-secondary)] w-56 truncate flex-shrink-0">{epic.title}</span>
                  <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${EPIC_COLORS[index % 5]} rounded-full`}
                      style={{ width: `${epic.totalTickets > 0 ? (epic.doneTickets / epic.totalTickets) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] w-16 text-right flex-shrink-0">{epic.doneTickets}/{epic.totalTickets}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Agent Performance</h3>
          <Link href="/agents" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-[var(--color-text-muted)] py-4">Discovering agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)] py-4">No agents found. Ensure your AWS credentials have access to Bedrock AgentCore.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-4">
                  <th className="text-left py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Agent</th>
                  <th className="text-right py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Sessions</th>
                  <th className="text-right py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Tokens (in/out)</th>
                  <th className="text-right py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Invocations</th>
                  <th className="text-right py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Avg Duration</th>
                  <th className="text-right py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Total Duration</th>
                  <th className="text-right py-3 px-3 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const am = metrics?.agentMetrics.find((m) => m.id === agent.id);
                  return (
                    <tr key={agent.id} className="border-b border-surface-4/50 hover:bg-surface-3/30 transition-colors">
                      <td className="py-4 px-3">
                        <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 hover:text-[var(--color-text-primary)]">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            agent.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20"
                          }`}>
                            {agent.type === "harness" ? (
                              <Brain className="w-4 h-4 text-brand-400" />
                            ) : (
                              <Cpu className="w-4 h-4 text-purple-400" />
                            )}
                          </div>
                          <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate max-w-[200px]">{agent.name}</span>
                        </Link>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-lg font-bold text-[var(--color-text-primary)]">{am?.sessions || 0}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-base font-semibold text-cyan-500">{formatNumber(am?.tokensIn || 0)}</span>
                        <span className="text-[var(--color-text-muted)] mx-1.5">|</span>
                        <span className="text-base font-semibold text-purple-500">{formatNumber(am?.tokensOut || 0)}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-lg font-bold text-green-400">{am?.invocations || 0}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-base font-semibold text-[var(--color-text-primary)]">{formatDuration(am?.avgDuration || 0)}</span>
                      </td>
                      <td className="text-right py-4 px-3">
                        <span className="text-lg font-bold text-emerald-500">{formatDuration(am?.totalDuration || 0)}</span>
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
  label, value, icon: Icon, color, sub, valueTitle,
}: {
  label: string;
  value: string;
  icon: typeof Bot;
  color: string;
  sub?: string;
  valueTitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={`w-5 h-5 ${color} opacity-60 mt-1 flex-shrink-0`} />
      <div>
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5" title={valueTitle}>{value}</p>
        {sub && <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
