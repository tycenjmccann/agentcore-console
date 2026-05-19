"use client";

import { useState, useMemo } from "react";
import {
  Brain,
  Cpu,
  Bot,
  Database,
  Terminal,
  Wrench,
  Server,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Zap,
} from "lucide-react";
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
  systemPrompt?: string;
  tools?: Array<{ type: string; name?: string }>;
}

interface IntakeCardProps {
  agent: AgentDetail;
}

export default function IntakeCard({ agent }: IntakeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusConfig = useMemo(() => {
    const isActive = agent.status === "ACTIVE" || agent.status === "READY";
    return {
      isActive,
      dotClass: isActive ? "bg-green-400 animate-pulse" : "bg-gray-500",
      badgeClass: isActive
        ? "bg-green-400/10 text-green-400 border-green-400/30"
        : "bg-gray-400/10 text-gray-400 border-gray-400/30",
    };
  }, [agent.status]);

  const typeConfig = useMemo(() => {
    return {
      isHarness: agent.type === "harness",
      iconBg: agent.type === "harness" ? "bg-brand-600/20" : "bg-purple-600/20",
      iconColor: agent.type === "harness" ? "text-brand-400" : "text-purple-400",
      badgeClass: agent.type === "harness"
        ? "bg-brand-600/10 text-brand-400 border-brand-600/30"
        : "bg-purple-600/10 text-purple-400 border-purple-600/30",
    };
  }, [agent.type]);

  const toolCount = agent.tools?.length || 0;
  const hasDetails = !!(agent.model || agent.memoryId || agent.logGroup || agent.createdAt || toolCount > 0 || agent.systemPrompt);

  return (
    <div className="card !py-3 !px-4">
      {/* Main row */}
      <div className="flex items-center gap-4">
        {/* Agent icon */}
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", typeConfig.iconBg)}>
          {typeConfig.isHarness ? (
            <Brain className={cn("w-5 h-5", typeConfig.iconColor)} />
          ) : (
            <Cpu className={cn("w-5 h-5", typeConfig.iconColor)} />
          )}
        </div>

        {/* Agent name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{agent.name}</h2>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", typeConfig.badgeClass)}>
              {agent.type.toUpperCase()}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border flex items-center gap-1", statusConfig.badgeClass)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dotClass)} />
              {agent.status}
            </span>
          </div>
          {/* Quick stats row */}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono flex items-center gap-1 group cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors"
              onClick={() => handleCopy(agent.arn, "arn")}
              title="Click to copy ARN"
            >
              {agent.arn.length > 50 ? agent.arn.slice(0, 25) + "..." + agent.arn.slice(-20) : agent.arn}
              {copiedField === "arn" ? (
                <Check className="w-2.5 h-2.5 text-green-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </span>
            {agent.model && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <Bot className="w-2.5 h-2.5" />
                {agent.model.split("/").pop()?.split(":")[0] || agent.model}
              </span>
            )}
            {toolCount > 0 && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <Wrench className="w-2.5 h-2.5" />
                {toolCount} tool{toolCount !== 1 ? "s" : ""}
              </span>
            )}
            {agent.memoryId && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <Database className="w-2.5 h-2.5" />
                Memory
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse button */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-3 transition-all",
              expanded && "bg-surface-3 text-[var(--color-text-secondary)]"
            )}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? "Less" : "Details"}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-surface-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
          {/* Key info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {agent.model && (
              <DetailField
                icon={Bot}
                label="Model"
                value={agent.model}
                mono
                copyable
                onCopy={(v) => handleCopy(v, "model")}
                copied={copiedField === "model"}
              />
            )}
            {agent.memoryId && (
              <DetailField
                icon={Database}
                label="Memory"
                value={agent.memoryId}
                mono
                truncate
                copyable
                onCopy={(v) => handleCopy(v, "memory")}
                copied={copiedField === "memory"}
              />
            )}
            {agent.logGroup && (
              <DetailField
                icon={Terminal}
                label="Log Group"
                value={agent.logGroup}
                mono
                truncate
                copyable
                onCopy={(v) => handleCopy(v, "logGroup")}
                copied={copiedField === "logGroup"}
              />
            )}
            {agent.createdAt && (
              <DetailField
                icon={Clock}
                label="Created"
                value={new Date(agent.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            )}
            {agent.updatedAt && (
              <DetailField
                icon={Zap}
                label="Updated"
                value={new Date(agent.updatedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            )}
          </div>

          {/* Tools section */}
          {agent.tools && agent.tools.length > 0 && (
            <div>
              <span className="text-[var(--color-text-muted)] text-xs flex items-center gap-1 mb-2">
                <Wrench className="w-3 h-3" /> Tools ({agent.tools.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((tool, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-1 bg-surface-3 rounded-md border border-surface-4 text-[var(--color-text-secondary)] flex items-center gap-1 hover:border-brand-600/30 transition-colors"
                  >
                    <Server className="w-2.5 h-2.5 text-[var(--color-text-muted)]" />
                    {tool.name || tool.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* System Prompt */}
          {agent.systemPrompt && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[var(--color-text-muted)] text-xs">System Prompt</span>
                <button
                  onClick={() => handleCopy(agent.systemPrompt!, "prompt")}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] flex items-center gap-1 transition-colors"
                >
                  {copiedField === "prompt" ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[10px] text-[var(--color-text-muted)] bg-surface-0 rounded-lg p-3 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto border border-surface-4 scrollbar-thin">
                {agent.systemPrompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  mono = false,
  truncate = false,
  copyable = false,
  onCopy,
  copied = false,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  copyable?: boolean;
  onCopy?: (value: string) => void;
  copied?: boolean;
}) {
  return (
    <div className="group">
      <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </span>
      <div className="flex items-center gap-1">
        <p
          className={cn(
            "text-[var(--color-text-secondary)] mt-0.5 text-[10px]",
            mono && "font-mono",
            truncate && "truncate"
          )}
          title={value}
        >
          {value}
        </p>
        {copyable && onCopy && (
          <button
            onClick={() => onCopy(value)}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            title={`Copy ${label}`}
          >
            {copied ? (
              <Check className="w-2.5 h-2.5 text-green-400" />
            ) : (
              <Copy className="w-2.5 h-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
