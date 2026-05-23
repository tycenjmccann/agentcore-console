"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Loader2, RefreshCw, ExternalLink, Zap } from "lucide-react";

interface ScorecardEntry {
  avg: number;
  count: number;
  passing: number;
}

interface AgentMetrics {
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  invocations?: number;
  cost?: number;
}

interface EvalData {
  agents: string[];
  scorecard: Record<string, Record<string, ScorecardEntry>>;
  metrics: Record<string, AgentMetrics>;
  evaluators: string[];
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
  if (score >= 0.9) return "#22c55e";
  if (score >= 0.75) return "#f59e0b";
  return "#ef4444";
}

function scoreBg(score: number): string {
  if (score >= 0.9) return "rgba(34,197,94,0.12)";
  if (score >= 0.75) return "rgba(245,158,11,0.12)";
  return "rgba(239,68,68,0.12)";
}

function formatTokens(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function EvaluationsPage() {
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loopEnabled, setLoopEnabled] = useState<boolean | null>(null);
  const [loopToggling, setLoopToggling] = useState(false);

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

  const fetchLoopStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/evaluations/loop");
      if (res.ok) {
        const { enabled } = await res.json();
        setLoopEnabled(enabled);
      }
    } catch {}
  }, []);

  const toggleLoop = async () => {
    if (loopEnabled === null) return;
    setLoopToggling(true);
    try {
      const res = await fetch("/api/evaluations/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !loopEnabled }),
      });
      if (res.ok) {
        const { enabled } = await res.json();
        setLoopEnabled(enabled);
      }
    } catch {} finally {
      setLoopToggling(false);
    }
  };

  useEffect(() => { fetchData(); fetchLoopStatus(); }, [fetchLoopStatus]);

  const agents = data?.agents || [];
  const hasScores = !!(data?.scorecard && Object.keys(data.scorecard).length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-400" />
            Evaluations
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            14 agents · 10 evaluators · Opus 4.7 judge · 100% sampling · last 24h
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loopEnabled !== null && (
            <button
              onClick={toggleLoop}
              disabled={loopToggling}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                loopEnabled
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-surface-2 border-surface-4 text-[var(--color-text-muted)] hover:border-emerald-500/30 hover:text-emerald-400"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${loopToggling ? "animate-pulse" : ""}`} />
              Self-Improvement
              <div className={`w-7 h-3.5 rounded-full relative transition-colors ${loopEnabled ? "bg-emerald-500" : "bg-surface-4"}`}>
                <div className={`absolute top-[3px] w-2.5 h-2.5 rounded-full bg-white transition-all ${loopEnabled ? "left-[15px]" : "left-[3px]"}`} />
              </div>
            </button>
          )}
          <a
            href="https://us-east-1.console.aws.amazon.com/bedrock-agentcore/home?region=us-east-1#/evaluations"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors text-xs text-[var(--color-text-secondary)]"
          >
            <ExternalLink className="w-3 h-3" /> Console
          </a>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600/20 border border-brand-600/30 text-brand-400 text-xs hover:bg-brand-600/30 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
        </div>
      )}

      {/* Single compact spreadsheet */}
      {data && (
        <div className="bg-surface-2 border border-surface-4 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-4 bg-surface-1">
                  <th className="text-left px-3 py-2 text-[var(--color-text-muted)] font-medium sticky left-0 bg-surface-1 z-10 min-w-[140px]">
                    Metric
                  </th>
                  {agents.map((agent) => (
                    <th
                      key={agent}
                      className="text-center px-2 py-2 font-medium whitespace-nowrap min-w-[72px]"
                      style={{ color: AGENT_COLORS[agent] || "#94a3b8" }}
                    >
                      <span className="block text-[10px] leading-tight">
                        {agent.replace(" Designer", "").replace(" Developer", "").replace(" & Compliance", "")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ─── Operational Metrics Section ─── */}
                <tr className="border-b border-surface-4/50 bg-surface-3/20">
                  <td colSpan={agents.length + 1} className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Operational Metrics
                  </td>
                </tr>
                {/* Sessions (invocations) */}
                <MetricRow
                  label="Sessions"
                  agents={agents}
                  renderCell={(agent) => {
                    const v = data.metrics[agent]?.invocations;
                    return v ? String(v) : "—";
                  }}
                />
                {/* Cost per session */}
                <MetricRow
                  label="Cost / Session"
                  agents={agents}
                  renderCell={(agent) => {
                    const m = data.metrics[agent];
                    if (!m?.cost || !m?.invocations) return "—";
                    const perSession = m.cost / m.invocations;
                    return `$${perSession < 1 ? perSession.toFixed(2) : perSession.toFixed(1)}`;
                  }}
                  cellColor={(agent) => {
                    const m = data.metrics[agent];
                    if (!m?.cost || !m?.invocations) return undefined;
                    const perSession = m.cost / m.invocations;
                    return perSession < 0.50 ? "#22c55e" : perSession < 2 ? "#f59e0b" : "#ef4444";
                  }}
                />
                {/* Latency */}
                <MetricRow
                  label="Avg Latency"
                  agents={agents}
                  renderCell={(agent) => {
                    const v = data.metrics[agent]?.latency;
                    if (!v) return "—";
                    return `${v}s`;
                  }}
                  cellColor={(agent) => {
                    const v = data.metrics[agent]?.latency;
                    if (!v) return undefined;
                    return v < 10 ? "#22c55e" : v < 30 ? "#f59e0b" : "#ef4444";
                  }}
                />
                {/* Tokens In */}
                <MetricRow
                  label="Tokens In"
                  agents={agents}
                  renderCell={(agent) => formatTokens(data.metrics[agent]?.tokensIn)}
                />
                {/* Tokens Out */}
                <MetricRow
                  label="Tokens Out"
                  agents={agents}
                  renderCell={(agent) => formatTokens(data.metrics[agent]?.tokensOut)}
                />

                {/* ─── Evaluator Scores Section ─── */}
                <tr className="border-b border-surface-4/50 bg-surface-3/20">
                  <td colSpan={agents.length + 1} className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Evaluator Scores
                  </td>
                </tr>
                {/* Overall Average */}
                {hasScores && (
                  <tr className="border-b border-surface-4/50">
                    <td className="px-3 py-1.5 font-semibold text-[var(--color-text-primary)] sticky left-0 bg-surface-2 z-10">
                      Overall Avg
                    </td>
                    {agents.map((agent) => {
                      const agentScores = data.scorecard[agent];
                      if (!agentScores || Object.keys(agentScores).length === 0) {
                        return <td key={agent} className="text-center text-[var(--color-text-muted)]">—</td>;
                      }
                      const entries = Object.values(agentScores);
                      const overall = entries.reduce((s, e) => s + e.avg, 0) / entries.length;
                      const pct = Math.round(overall * 100);
                      return (
                        <td key={agent} className="text-center py-1.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold"
                            style={{ color: scoreColor(overall), backgroundColor: scoreBg(overall) }}
                          >
                            {pct}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )}
                {/* Individual evaluator rows */}
                {data.evaluators.map((ev) => (
                  <tr key={ev} className="border-b border-surface-4/30 hover:bg-surface-3/20">
                    <td className="px-3 py-1.5 text-[var(--color-text-secondary)] sticky left-0 bg-surface-2 z-10">
                      {ev}
                    </td>
                    {agents.map((agent) => {
                      const entry = data.scorecard[agent]?.[`Builtin.${ev}`] || data.scorecard[agent]?.[ev];
                      if (!entry) return <td key={agent} className="text-center text-[var(--color-text-muted)]">—</td>;
                      const pct = Math.round(entry.avg * 100);
                      return (
                        <td key={agent} className="text-center py-1.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium"
                            style={{ color: scoreColor(entry.avg), backgroundColor: scoreBg(entry.avg) }}
                          >
                            {pct}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-3 py-2 border-t border-surface-4 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
            <span>Updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : "—"}</span>
            <span>Scores color: <span className="text-emerald-400">≥90%</span> · <span className="text-amber-400">≥75%</span> · <span className="text-red-400">&lt;75%</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Metric Row Component ─────────────────────────────────────────────────────

function MetricRow({
  label,
  agents,
  renderCell,
  cellColor,
}: {
  label: string;
  agents: string[];
  renderCell: (agent: string) => string;
  cellColor?: (agent: string) => string | undefined;
}) {
  return (
    <tr className="border-b border-surface-4/30 hover:bg-surface-3/20">
      <td className="px-3 py-1.5 text-[var(--color-text-secondary)] sticky left-0 bg-surface-2 z-10">
        {label}
      </td>
      {agents.map((agent) => {
        const value = renderCell(agent);
        const color = cellColor?.(agent);
        return (
          <td key={agent} className="text-center py-1.5">
            <span
              className="text-[11px]"
              style={color ? { color } : { color: value === "—" ? "var(--color-text-muted)" : "var(--color-text-secondary)" }}
            >
              {value}
            </span>
          </td>
        );
      })}
    </tr>
  );
}
