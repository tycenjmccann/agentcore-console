"use client";

import { useState, useEffect } from "react";
import { BarChart3, Activity, Clock, DollarSign, CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink } from "lucide-react";

interface EvalConfig {
  id: string;
  name: string;
  status: string;
  executionStatus: string;
  samplingRate: number;
  evaluators: string[];
}

interface ScorecardEntry {
  avg: number;
  count: number;
  passing: number;
}

interface EvalData {
  configs: EvalConfig[];
  scorecard: Record<string, Record<string, ScorecardEntry>>;
  latency: Record<string, { avg: number; count: number }>;
  evaluators: string[];
  judgeModel: string;
  samplingRate: string;
  lastUpdated: string;
}

const AGENT_COLORS: Record<string, string> = {
  "Requirements Analyst": "#8b5cf6",
  "Analytics Designer": "#06b6d4",
  "Android Designer": "#10b981",
  "Backend Designer": "#f59e0b",
  "Frontend Designer": "#ec4899",
  "iOS Designer": "#6366f1",
  "Legal & Compliance": "#64748b",
  "Localization": "#14b8a6",
  "API Developer": "#f97316",
  "Backend Developer": "#eab308",
  "Frontend Developer": "#a855f7",
  "QA Verifier": "#22c55e",
  "CI Agent": "#3b82f6",
  "Security Reviewer": "#ef4444",
};

function scoreColor(score: number): string {
  if (score >= 0.8) return "#22c55e";
  if (score >= 0.5) return "#f59e0b";
  return "#ef4444";
}

function scoreBg(score: number): string {
  if (score >= 0.8) return "rgba(34,197,94,0.15)";
  if (score >= 0.5) return "rgba(245,158,11,0.15)";
  return "rgba(239,68,68,0.15)";
}

export default function EvaluationsPage() {
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"scorecard" | "configs" | "overview">("overview");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evaluations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const hasScores = !!(data?.scorecard && Object.keys(data.scorecard).length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-400" />
            Agent Evaluations
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Continuous quality monitoring across all 14 fleet agents — Opus 4.7 judge, 100% sampling
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`https://us-east-1.console.aws.amazon.com/bedrock-agentcore/home?region=us-east-1#/evaluations`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors text-xs text-[var(--color-text-secondary)]"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Console
          </a>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 border border-brand-600/30 text-brand-400 text-xs hover:bg-brand-600/30 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 p-1 rounded-lg w-fit border border-surface-4">
        {(["overview", "scorecard", "configs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "scorecard" ? "Scorecard" : "Configs"}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      )}

      {data && activeTab === "overview" && (
        <OverviewTab data={data} hasScores={hasScores} />
      )}

      {data && activeTab === "scorecard" && (
        <ScorecardTab data={data} hasScores={hasScores} />
      )}

      {data && activeTab === "configs" && (
        <ConfigsTab data={data} />
      )}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ data, hasScores }: { data: EvalData; hasScores: boolean }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Activity className="w-5 h-5 text-brand-400" />} label="Agents Monitored" value="14" />
        <StatCard icon={<BarChart3 className="w-5 h-5 text-emerald-400" />} label="Evaluators per Agent" value="10" />
        <StatCard icon={<DollarSign className="w-5 h-5 text-amber-400" />} label="Sampling Rate" value="100%" />
        <StatCard icon={<Clock className="w-5 h-5 text-cyan-400" />} label="Judge Model" value="Opus 4.7" />
      </div>

      {/* Evaluator List */}
      <div className="bg-surface-2 border border-surface-4 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Active Evaluators</h3>
        <div className="grid grid-cols-2 gap-3">
          {data.evaluators.map((ev) => (
            <div key={ev} className="flex items-center gap-2 px-3 py-2 bg-surface-1 rounded-lg border border-surface-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm text-[var(--color-text-secondary)]">{ev}</span>
              <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                {ev.includes("Tool") ? "TOOL_CALL" : ev.includes("Goal") || ev.includes("Dependency") || ev.includes("Trajectory") ? "SESSION" : "TRACE"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Fleet Grid */}
      <div className="bg-surface-2 border border-surface-4 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Fleet Coverage</h3>
        <div className="grid grid-cols-7 gap-2">
          {data.configs.map((config) => (
            <div
              key={config.id}
              className="flex flex-col items-center gap-1 p-3 bg-surface-1 rounded-lg border border-surface-4"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: AGENT_COLORS[config.name] || "#64748b" }}
              />
              <span className="text-[10px] text-[var(--color-text-muted)] text-center leading-tight">
                {config.name.replace(" Designer", "").replace(" Developer", "")}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                config.executionStatus === "ENABLED"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {config.executionStatus === "ENABLED" ? "ON" : "OFF"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!hasScores && (
        <div className="bg-surface-2 border border-surface-4 rounded-xl p-8 text-center">
          <BarChart3 className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Awaiting First Evaluation</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-md mx-auto">
            Evaluations are configured and active. Results will appear here after the next pipeline run
            triggers agent invocations. The Opus 4.7 judge will score each interaction automatically.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Scorecard Tab ──────────────────────────────────────────────────────────

function ScorecardTab({ data, hasScores }: { data: EvalData; hasScores: boolean }) {
  if (!hasScores) {
    return (
      <div className="bg-surface-2 border border-surface-4 rounded-xl p-12 text-center">
        <BarChart3 className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">No Evaluation Data Yet</h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-lg mx-auto">
          Run a pipeline workflow to generate evaluation data. Each agent invocation will be scored
          by the Opus 4.7 judge across all 10 evaluators. Results typically appear 2-5 minutes after invocation.
        </p>
      </div>
    );
  }

  const agents = Object.keys(data.scorecard);
  const allEvaluators = new Set<string>();
  for (const agentScores of Object.values(data.scorecard)) {
    for (const ev of Object.keys(agentScores)) {
      allEvaluators.add(ev);
    }
  }
  const evaluators = Array.from(allEvaluators);

  return (
    <div className="space-y-6">
      {/* Scorecard Table */}
      <div className="bg-surface-2 border border-surface-4 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Performance Scorecard</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Average scores from online evaluations — judge: Opus 4.7
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-4">
                <th className="text-left px-4 py-3 text-[var(--color-text-muted)] font-medium">Evaluator</th>
                {agents.map((agent) => (
                  <th key={agent} className="text-center px-3 py-3 font-medium" style={{ color: AGENT_COLORS[agent] || "#94a3b8" }}>
                    {agent.replace(" Designer", "").replace(" Developer", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Latency row */}
              {Object.keys(data.latency).length > 0 && (
                <tr className="border-b border-surface-4/50">
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)]">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Avg Latency</span>
                  </td>
                  {agents.map((agent) => {
                    const lat = data.latency[agent];
                    if (!lat) return <td key={agent} className="text-center text-[var(--color-text-muted)]">—</td>;
                    const color = lat.avg < 10 ? "#22c55e" : lat.avg < 30 ? "#f59e0b" : "#ef4444";
                    return (
                      <td key={agent} className="text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color, backgroundColor: `${color}20` }}>
                          {lat.avg}s
                        </span>
                      </td>
                    );
                  })}
                </tr>
              )}
              {/* Evaluator rows */}
              {evaluators.map((ev) => (
                <tr key={ev} className="border-b border-surface-4/50 hover:bg-surface-3/30">
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)]">
                    {ev.replace("Builtin.", "")}
                  </td>
                  {agents.map((agent) => {
                    const entry = data.scorecard[agent]?.[ev];
                    if (!entry) return <td key={agent} className="text-center text-[var(--color-text-muted)]">—</td>;
                    const pct = Math.round(entry.avg * 100);
                    return (
                      <td key={agent} className="text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: scoreColor(entry.avg), backgroundColor: scoreBg(entry.avg) }}
                        >
                          {pct}%
                          <span className="text-[10px] opacity-60">({entry.count})</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Configs Tab ────────────────────────────────────────────────────────────

function ConfigsTab({ data }: { data: EvalData }) {
  return (
    <div className="space-y-4">
      <div className="bg-surface-2 border border-surface-4 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Online Evaluation Configurations</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">14 agents × 10 evaluators × 100% sampling</p>
          </div>
          <a
            href="https://us-east-1.console.aws.amazon.com/bedrock-agentcore/home?region=us-east-1#/evaluations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-400 hover:underline flex items-center gap-1"
          >
            Manage in Console <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-4 text-[var(--color-text-muted)]">
              <th className="text-left px-4 py-2.5 font-medium">Agent</th>
              <th className="text-left px-4 py-2.5 font-medium">Config ID</th>
              <th className="text-center px-4 py-2.5 font-medium">Status</th>
              <th className="text-center px-4 py-2.5 font-medium">Sampling</th>
              <th className="text-center px-4 py-2.5 font-medium">Evaluators</th>
            </tr>
          </thead>
          <tbody>
            {data.configs.map((config) => (
              <tr key={config.id} className="border-b border-surface-4/50 hover:bg-surface-3/30">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AGENT_COLORS[config.name] || "#64748b" }} />
                    <span className="font-medium text-[var(--color-text-primary)]">{config.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">{config.id}</td>
                <td className="text-center px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs ${
                    config.status === "ACTIVE" ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {config.status === "ACTIVE" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {config.status}
                  </span>
                </td>
                <td className="text-center px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">{config.samplingRate}%</td>
                <td className="text-center px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">{config.evaluators.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface-2 border border-surface-4 rounded-xl p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
      </div>
    </div>
  );
}
