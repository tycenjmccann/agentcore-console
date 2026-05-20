"use client";

import { useState, useEffect } from "react";
import { Layers, Bot, TrendingUp, Clock } from "lucide-react";
import { cachedFetch } from "@/lib/client-cache";
import MetricCard from "./MetricCard";
import MetricCardSkeleton from "./MetricCardSkeleton";

// --- Types ---

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
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
}

interface Workflow {
  id: string;
  status?: string;
  [key: string]: unknown;
}

interface WorkflowListResponse {
  workflows: Workflow[];
}

type HealthStatus = "green" | "yellow" | "red";

// --- Helpers ---

/**
 * Generate a 7-point sparkline trend from a base value with ±10% variance.
 * TODO: Replace with real trend data from `/api/metrics/trends?days=7` when available.
 */
function generateSparkline(baseValue: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 7; i++) {
    const variance = 0.1;
    const multiplier = 1 + (Math.random() * 2 - 1) * variance;
    points.push(Math.max(0, Math.round(baseValue * multiplier)));
  }
  // Make last point close to actual value for visual coherence
  points[6] = baseValue;
  return points;
}

function computeSuccessRate(workflows: Workflow[]): number {
  if (workflows.length === 0) return 0;
  const successful = workflows.filter(
    (w) => w.status === "completed" || w.status === "COMPLETED" || w.status === "success" || w.status === "SUCCESS"
  ).length;
  return Math.round((successful / workflows.length) * 100);
}

function getWorkflowStatus(workflows: Workflow[], hasError: boolean): HealthStatus {
  if (hasError) return "red";
  if (workflows.length === 0) return "yellow";
  return "green";
}

function getAgentStatus(agents: Agent[]): HealthStatus {
  if (agents.length === 0) return "yellow";
  const active = agents.filter((a) => a.status === "ACTIVE" || a.status === "READY").length;
  const ratio = active / agents.length;
  if (ratio >= 1) return "green";
  if (ratio >= 0.5) return "yellow";
  return "red";
}

function getSuccessRateStatus(rate: number): HealthStatus {
  if (rate >= 90) return "green";
  if (rate >= 70) return "yellow";
  return "red";
}

function getCompletionTimeStatus(seconds: number): HealthStatus {
  if (seconds < 300) return "green"; // < 5 min
  if (seconds <= 900) return "yellow"; // 5-15 min
  return "red"; // > 15 min
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// --- Component ---

export default function MetricsGrid() {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [workflowRes, agentsRes, metricsRes] = await Promise.all([
          cachedFetch<WorkflowListResponse>("/api/workflow/list").catch(() => ({ workflows: [] })),
          cachedFetch<Agent[]>("/api/agentcore/agents").catch(() => []),
          cachedFetch<MetricsData>("/api/agentcore/metrics").catch(() => null),
        ]);

        const workflowData = workflowRes && "workflows" in workflowRes ? workflowRes.workflows : [];
        setWorkflows(Array.isArray(workflowData) ? workflowData : []);
        setAgents(Array.isArray(agentsRes) ? agentsRes : []);
        if (metricsRes && !(metricsRes as Record<string, unknown>).error) {
          setMetrics(metricsRes);
        }
      } catch {
        setHasError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  // Computed metrics
  const totalWorkflows = workflows.length;
  const activeWorkflows = workflows.filter(
    (w) => w.status === "running" || w.status === "RUNNING" || w.status === "in_progress" || w.status === "IN_PROGRESS"
  ).length;

  const activeAgents = agents.filter((a) => a.status === "ACTIVE" || a.status === "READY").length;
  const totalAgents = agents.length;

  const successRate = computeSuccessRate(workflows);

  const avgDuration = metrics?.usage.avgSessionDuration ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Workflows"
        value={totalWorkflows}
        subtitle={`${activeWorkflows} active`}
        icon={Layers}
        color="text-brand-400"
        sparklineData={generateSparkline(totalWorkflows)}
        status={getWorkflowStatus(workflows, hasError)}
        animationDelay={0}
      />
      <MetricCard
        title="Active Agents"
        value={activeAgents}
        subtitle={`of ${totalAgents} total`}
        icon={Bot}
        color="text-green-400"
        sparklineData={generateSparkline(activeAgents)}
        status={getAgentStatus(agents)}
        animationDelay={100}
      />
      <MetricCard
        title="Success Rate"
        value={successRate}
        subtitle="last 7 days"
        icon={TrendingUp}
        color="text-cyan-400"
        sparklineData={generateSparkline(successRate)}
        status={getSuccessRateStatus(successRate)}
        formatValue={(v) => `${v}%`}
        animationDelay={200}
      />
      <MetricCard
        title="Avg Completion"
        value={avgDuration}
        subtitle="per workflow"
        icon={Clock}
        color="text-yellow-400"
        sparklineData={generateSparkline(avgDuration)}
        status={getCompletionTimeStatus(avgDuration)}
        formatValue={(v) => formatDurationShort(v)}
        animationDelay={300}
      />
    </div>
  );
}
