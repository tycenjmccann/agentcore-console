"use client";

import { useState, useEffect } from "react";
import {
  Link2,
  Github,
  Cloud,
  MessageSquare,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cachedFetch, getCached, invalidateCache } from "@/lib/client-cache";

interface CheckItem {
  name: string;
  status: "pass" | "fail" | "in_progress" | "pending";
  detail?: string;
}

interface Connector {
  id: string;
  name: string;
  status: "connected" | "failed" | "validating";
  description: string;
  lastValidated: string | null;
  checks: {
    total: number;
    passed: number;
    items: CheckItem[];
  };
  progress?: number;
}

const connectorIcons: Record<string, React.ElementType> = {
  github: Github,
  jira: AlertTriangle,
  slack: MessageSquare,
  s3: Cloud,
};

function StatusDot({ status }: { status: Connector["status"] }) {
  if (status === "connected") {
    return <span className="inline-block w-2 h-2 rounded-full bg-green-400" />;
  }
  if (status === "failed") {
    return <span className="inline-block w-2 h-2 rounded-full bg-red-400" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />;
}

function StatusBadge({ status }: { status: Connector["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Connected
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-red-400/10 text-red-400 border border-red-400/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      Validating
    </span>
  );
}

function CheckIcon({ status }: { status: CheckItem["status"] }) {
  if (status === "pass") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />;
  }
  if (status === "fail") {
    return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  }
  if (status === "in_progress") {
    return <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />;
  }
  return <span className="w-3.5 h-3.5 flex items-center justify-center text-gray-500 shrink-0">●</span>;
}

function ConnectorCard({ connector }: { connector: Connector }) {
  const Icon = connectorIcons[connector.id] || Link2;
  const borderClass =
    connector.status === "connected"
      ? "border-green-400/20"
      : connector.status === "failed"
        ? "border-red-400/30"
        : "border-blue-400/30";

  return (
    <div className={`card ${borderClass}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{connector.name}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{connector.description}</p>
          </div>
        </div>
        <StatusBadge status={connector.status} />
      </div>

      {connector.status === "validating" && connector.progress != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-400">Validation in progress...</span>
            <span className="text-xs text-[var(--color-text-muted)]">{connector.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${connector.progress}%` }}
            />
          </div>
        </div>
      )}

      {connector.lastValidated && (
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Last validated {connector.lastValidated} · {connector.checks.passed}/{connector.checks.total} checks passed
        </p>
      )}

      <div className="space-y-1.5 mt-3 pt-3 border-t border-surface-4">
        {connector.checks.items.map((check) => (
          <div key={check.name} className="flex items-start gap-2">
            <CheckIcon status={check.status} />
            <div className="min-w-0">
              <span className="text-xs text-[var(--color-text-secondary)]">{check.name}</span>
              {check.detail && (
                <p className="text-xs text-red-400/80 mt-0.5">{check.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const validationHistory = [
  { connector: "GitHub", status: "connected", checks: "5/5", duration: "1.2s", timestamp: "2 min ago" },
  { connector: "Jira", status: "failed", checks: "2/4", duration: "3.4s", timestamp: "15 min ago" },
  { connector: "AWS S3", status: "connected", checks: "4/4", duration: "2.1s", timestamp: "1 hour ago" },
  { connector: "Slack", status: "connected", checks: "4/4", duration: "1.8s", timestamp: "2 hours ago" },
  { connector: "GitHub", status: "connected", checks: "5/5", duration: "1.1s", timestamp: "3 hours ago" },
];

export default function ConnectorsPage() {
  const cacheKey = "/api/connectors";
  const [connectors, setConnectors] = useState<Connector[]>(() => {
    const cached = getCached<{ connectors: Connector[] }>(cacheKey);
    return cached?.connectors || [];
  });
  const [loading, setLoading] = useState(!getCached(cacheKey));
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    cachedFetch<{ connectors: Connector[] }>(cacheKey)
      .then((data) => {
        if (data?.connectors) {
          setConnectors(data.connectors);
        }
      })
      .catch(() => setConnectors([]))
      .finally(() => setLoading(false));
  }, []);

  const handleValidateAll = async () => {
    setValidating(true);
    setConnectors((prev) =>
      prev.map((c) => ({ ...c, status: "validating" as const }))
    );

    try {
      const res = await fetch("/api/connectors/validate", { method: "POST" });
      const data = await res.json();

      invalidateCache(cacheKey);
      const refreshed = await cachedFetch<{ connectors: Connector[] }>(cacheKey, { forceRefresh: true });
      if (refreshed?.connectors) {
        setConnectors(
          refreshed.connectors.map((c) => {
            const result = data.results.find((r: { id: string }) => r.id === c.id);
            return result ? { ...c, status: result.status } : c;
          })
        );
      }
    } catch {
      const refreshed = await cachedFetch<{ connectors: Connector[] }>(cacheKey, { forceRefresh: true });
      if (refreshed?.connectors) setConnectors(refreshed.connectors);
    } finally {
      setValidating(false);
    }
  };

  const healthyCount = connectors.filter((c) => c.status === "connected").length;
  const validatingCount = connectors.filter((c) => c.status === "validating").length;
  const failedCount = connectors.filter((c) => c.status === "failed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading connectors...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Connector Validation</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Monitor and validate external service connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1.5" disabled>
            <Plus className="w-3.5 h-3.5" />
            Add Connector
          </button>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={handleValidateAll}
            disabled={validating}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${validating ? "animate-spin" : ""}`} />
            Validate All
          </button>
        </div>
      </div>

      {/* Status summary bar */}
      <div className="card flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">{healthyCount}</span> Healthy
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">{validatingCount}</span> Validating
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">{failedCount}</span> Failed
          </span>
        </div>
      </div>

      {/* Connector cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {connectors.map((connector) => (
          <ConnectorCard key={connector.id} connector={connector} />
        ))}
      </div>

      {/* Validation History */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Validation History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-4">
                <th className="text-left pb-2 text-[var(--color-text-muted)] font-medium">Connector</th>
                <th className="text-left pb-2 text-[var(--color-text-muted)] font-medium">Status</th>
                <th className="text-left pb-2 text-[var(--color-text-muted)] font-medium">Checks</th>
                <th className="text-left pb-2 text-[var(--color-text-muted)] font-medium">Duration</th>
                <th className="text-left pb-2 text-[var(--color-text-muted)] font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {validationHistory.map((entry, i) => (
                <tr key={i} className="border-b border-surface-4 last:border-0">
                  <td className="py-2.5 text-[var(--color-text-secondary)]">{entry.connector}</td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={entry.status as Connector["status"]} />
                      <span className="text-[var(--color-text-secondary)] capitalize">{entry.status}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-[var(--color-text-secondary)]">{entry.checks}</td>
                  <td className="py-2.5 text-[var(--color-text-muted)]">{entry.duration}</td>
                  <td className="py-2.5 text-[var(--color-text-muted)]">{entry.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
