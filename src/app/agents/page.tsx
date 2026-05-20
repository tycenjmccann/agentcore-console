"use client";

import { useState, useEffect } from "react";
import {
  Bot, Brain, Cpu, Loader2, Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cachedFetch, getCached } from "@/lib/client-cache";
import { DataTable, ColumnDef } from "@/components/DataTable";
import { cn } from "@/lib/utils";

interface AgentDetail {
  id: string;
  name: string;
  arn: string;
  type: "harness" | "runtime";
  status: string;
  createdAt?: string;
  updatedAt?: string;
  memoryId?: string | null;
  logGroup?: string | null;
  model?: string;
  description?: string;
  tools?: Array<{ type: string; name?: string }>;
}

export default function AgentsPage() {
  const cacheKey = "/api/agentcore/agents";
  const [agents, setAgents] = useState<AgentDetail[]>(() => getCached<AgentDetail[]>(cacheKey) || []);
  const [loading, setLoading] = useState(!getCached(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    cachedFetch<AgentDetail[] | { error: string }>(cacheKey)
      .then(async (data) => {
        if (data && typeof data === "object" && "error" in data) {
          setError(data.error);
          setAgents([]);
          return;
        }
        const list = Array.isArray(data) ? data : [];
        setAgents(list);

        // Enrich each agent with detail (model, tools, description) in parallel
        const enriched = await Promise.all(
          list.map(async (agent: AgentDetail) => {
            try {
              const detail = await cachedFetch<AgentDetail>(`/api/agentcore/agents?id=${agent.id}`);
              return { ...agent, ...detail };
            } catch { /* keep basic info */ }
            return agent;
          })
        );
        setAgents(enriched);
      })
      .catch((err) => {
        setError(err.message);
        setAgents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // ─── Column definitions ──────────────────────────────────────────────────
  const columns: ColumnDef<AgentDetail>[] = [
    {
      key: "name",
      header: "Name",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
            row.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20"
          )}>
            {row.type === "harness" ? (
              <Brain className="w-4 h-4 text-brand-400" />
            ) : (
              <Cpu className="w-4 h-4 text-purple-400" />
            )}
          </div>
          <span className="font-medium text-[--color-text-primary]">{row.name}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (value) => {
        const t = value as string;
        return (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded border",
            t === "harness"
              ? "bg-brand-600/10 text-brand-400 border-brand-600/30"
              : "bg-purple-600/10 text-purple-400 border-purple-600/30"
          )}>
            {t ? t.toUpperCase() : "—"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (value) => {
        const s = value as string;
        const isActive = s === "ACTIVE" || s === "READY";
        return (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full border",
            isActive
              ? "bg-green-400/10 text-green-400 border-green-400/30"
              : "bg-gray-400/10 text-gray-400 border-gray-400/30"
          )}>
            {s || "—"}
          </span>
        );
      },
    },
    {
      key: "model",
      header: "Model",
      render: (value) => {
        const m = value as string | undefined;
        if (!m) return <span className="text-[--color-text-muted]">—</span>;
        const display = m.split("/").pop()?.split(":")[0] || m;
        return <span className="text-[--color-text-secondary]">{display}</span>;
      },
    },
    {
      key: "tools",
      header: "Tools",
      render: (value) => {
        const tools = value as Array<{ type: string; name?: string }> | undefined;
        if (!tools || tools.length === 0) {
          return <span className="text-[--color-text-muted]">—</span>;
        }
        return (
          <span className="inline-flex items-center gap-1 text-[--color-text-secondary]">
            <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
            {tools.length}
          </span>
        );
      },
      comparator: (a, b) => {
        const aLen = a.tools?.length ?? 0;
        const bLen = b.tools?.length ?? 0;
        return aLen - bLen;
      },
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (value) => {
        const d = value as string | undefined;
        if (!d) return <span className="text-[--color-text-muted]">—</span>;
        return (
          <span className="text-[--color-text-secondary]">
            {new Date(d).toLocaleDateString()}
          </span>
        );
      },
      comparator: (a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return aTime - bTime;
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        <span className="ml-2 text-sm text-[--color-text-muted]">Discovering agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[--color-text-primary]">Agents</h2>
          <p className="text-xs text-[--color-text-muted] mt-0.5">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} discovered in your account
          </p>
        </div>
      </div>

      {error ? (
        <div className="card border-red-500/20 text-center py-12">
          <Bot className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-sm text-red-400">Failed to discover agents</p>
          <p className="text-xs text-[--color-text-muted] mt-2 max-w-md mx-auto">{error}</p>
          <div className="mt-4 text-xs text-[--color-text-muted] space-y-1">
            <p>Common causes:</p>
            <ul className="list-disc list-inside text-left max-w-sm mx-auto space-y-0.5">
              <li>AWS credentials not configured or expired</li>
              <li>Region mismatch — agents are deployed in a different region (check the region selector above)</li>
              <li>Missing IAM permissions: <code className="text-[--color-text-secondary]">bedrock-agentcore:ListHarnesses</code>, <code className="text-[--color-text-secondary]">bedrock-agentcore:ListAgentRuntimes</code></li>
              <li>No agents deployed to Bedrock AgentCore in this account</li>
            </ul>
          </div>
        </div>
      ) : agents.length === 0 ? (
        <div className="card text-center py-12">
          <Bot className="w-10 h-10 text-[--color-text-muted] mx-auto mb-3" />
          <p className="text-sm text-[--color-text-secondary]">No agents found in this region.</p>
          <p className="text-xs text-[--color-text-muted] mt-1">
            Deploy a harness or runtime to Bedrock AgentCore, or try switching the region in the header.
          </p>
        </div>
      ) : (
        <DataTable<AgentDetail>
          columns={columns}
          data={agents}
          getRowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/agents/${row.id}`)}
          filterPlaceholder="Filter agents..."
          emptyMessage="No agents match your filter."
        />
      )}
    </div>
  );
}
