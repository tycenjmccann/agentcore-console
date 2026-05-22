"use client";

import { useState, useRef, useEffect } from "react";
import {
  Ticket,
  Palette,
  RefreshCw,
  Code2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Play,
  GitPullRequest,
  ExternalLink,
  Sparkles,
  ArrowDown,
  History,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getClientRegion } from "@/lib/client-cache";

// --- Types ---

type StageStatus = "pending" | "active" | "complete" | "error";

interface Stage {
  id: string;
  label: string;
  icon: React.ElementType;
  status: StageStatus;
  output?: string;
  skill?: string;
  error?: string;
}

interface SampleTicket {
  ticketId: string;
  title: string;
  description: string;
  designAgent: string;
  devAgent: string;
  tags: string[];
}

// --- Constants (overridden by env vars via /api/agentcore/routing-config) ---

const DEFAULT_DESIGN_AGENT_ID = "";
const DEFAULT_DEV_AGENT_ID = "";

const SAMPLE_TICKETS: SampleTicket[] = [
  {
    ticketId: "IOS-1042",
    title: "Add push notification support for iOS",
    description:
      "As a user, I want to receive push notifications for new matches and messages so I can stay engaged with the app even when it's not open. Support both foreground and background notifications with rich content (images, action buttons).",
    designAgent: DEFAULT_DESIGN_AGENT_ID,
    devAgent: DEFAULT_DEV_AGENT_ID,
    tags: ["ios", "notifications", "engagement"],
  },
  {
    ticketId: "SEC-1043",
    title: "Implement rate limiting on the API",
    description:
      "We need to protect our API endpoints from abuse. Implement token-bucket rate limiting with per-user and per-IP limits. Include configurable thresholds, proper 429 responses with Retry-After headers, and metrics emission for monitoring.",
    designAgent: DEFAULT_DESIGN_AGENT_ID,
    devAgent: DEFAULT_DEV_AGENT_ID,
    tags: ["backend", "security", "infrastructure"],
  },
  {
    ticketId: "LEGAL-1044",
    title: "Add GDPR data export endpoint",
    description:
      "To comply with GDPR Article 20, implement a data portability endpoint that allows users to request a full export of their personal data in a machine-readable format (JSON). Must include all profile data, messages, preferences, and activity logs.",
    designAgent: DEFAULT_DESIGN_AGENT_ID,
    devAgent: DEFAULT_DEV_AGENT_ID,
    tags: ["privacy", "compliance", "backend"],
  },
  {
    ticketId: "L10N-1045",
    title: "Add Spanish language support",
    description:
      "Internationalize the app to support Spanish (es-ES and es-MX). Extract all user-facing strings into locale files, implement language switching in settings, and ensure proper RTL/pluralization handling. Cover both the mobile app and notification templates.",
    designAgent: DEFAULT_DESIGN_AGENT_ID,
    devAgent: DEFAULT_DEV_AGENT_ID,
    tags: ["localization", "i18n", "mobile"],
  },
];

const INITIAL_STAGES: Stage[] = [
  { id: "intake", label: "Jira Intake", icon: Ticket, status: "pending" },
  { id: "design", label: "Design Agent", icon: Palette, status: "pending" },
  { id: "jira-update", label: "Jira Update", icon: RefreshCw, status: "pending" },
  { id: "dev", label: "Dev Agent", icon: Code2, status: "pending" },
  { id: "complete", label: "Complete", icon: CheckCircle2, status: "pending" },
];

// --- Helpers ---

function StatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "pending":
      return <Circle className="w-5 h-5 text-gray-600" />;
    case "active":
      return (
        <div className="relative">
          <Circle className="w-5 h-5 text-brand-400" />
          <div className="absolute inset-0 w-5 h-5 rounded-full bg-brand-400/30 animate-ping" />
        </div>
      );
    case "complete":
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    case "error":
      return <AlertCircle className="w-5 h-5 text-red-400" />;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main Component ---

export default function RoutingPage() {
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SampleTicket | null>(null);
  const [agentIds, setAgentIds] = useState({ design: DEFAULT_DESIGN_AGENT_ID, dev: DEFAULT_DEV_AGENT_ID });
  const [arnPrefix, setArnPrefix] = useState(process.env.NEXT_PUBLIC_AGENTCORE_ARN_PREFIX || "");
  const [lastSessionIds, setLastSessionIds] = useState<{ design?: string; dev?: string }>({});
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight requests on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Load agent IDs and ARN config from server (env vars override defaults)
  useEffect(() => {
    fetch("/api/agentcore/routing-config", { headers: { "x-aws-region": getClientRegion() } })
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.designAgentId) setAgentIds((prev) => ({ ...prev, design: cfg.designAgentId }));
        if (cfg.devAgentId) setAgentIds((prev) => ({ ...prev, dev: cfg.devAgentId }));
        if (cfg.region && cfg.accountId) {
          setArnPrefix(`arn:aws:bedrock-agentcore:${cfg.region}:${cfg.accountId}:harness`);
        }
      })
      .catch(() => {});
  }, []);

  function updateStage(id: string, updates: Partial<Stage>) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }

  async function invokeAgent(agentId: string, prompt: string, stage: string): Promise<string> {
    const harnessArn = `${arnPrefix}/${agentId}`;
    // Session ID includes ticket number for correlation in Ticket History
    const ticket = ticketNumber || `PROJ-${Math.floor(1000 + Math.random() * 9000)}`;
    const sessionId = `${ticket}_${stage}_sess_${crypto.randomUUID().replace(/-/g, "")}${Date.now()}`;

    // Track session IDs for display
    setLastSessionIds((prev) => ({ ...prev, [stage]: sessionId }));

    const res = await fetch("/api/agentcore/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-aws-region": getClientRegion() },
      body: JSON.stringify({
        agentRuntimeArn: harnessArn,
        isHarness: true,
        prompt,
        sessionId,
      }),
      signal: abortRef.current?.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `Agent invocation failed (${res.status})`);
    }

    // Read the streaming response
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
    }

    return fullText;
  }

  async function runPipeline() {
    if (!ticketTitle.trim() || !ticketDescription.trim()) return;

    setIsRunning(true);
    abortRef.current = new AbortController();
    setStages(INITIAL_STAGES);

    const ticket = selectedTicket || SAMPLE_TICKETS[0];

    try {
      // Stage 1: Intake (instant)
      updateStage("intake", { status: "active" });
      await delay(800);
      updateStage("intake", {
        status: "complete",
        output: `Ticket ingested: "${ticketTitle}"`,
      });

      // Stage 2: Design Agent
      updateStage("design", { status: "active" });
      let designOutput = "";
      try {
        const designPrompt = `You are a software design agent. Given this Jira ticket, produce a concise technical design document.\n\nTitle: ${ticketTitle}\nDescription: ${ticketDescription}\n\nProduce a design covering: architecture decisions, components involved, data flow, and key interfaces. Be concise but complete.`;

        designOutput = await invokeAgent(agentIds.design, designPrompt, "design");
        updateStage("design", {
          status: "complete",
          output: designOutput || "(Design agent returned empty response)",
          skill: inferSkill(ticketTitle),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateStage("design", { status: "error", error: msg });
        throw err;
      }

      // Stage 3: Jira Update (mocked)
      updateStage("jira-update", { status: "active" });
      await delay(2000);
      updateStage("jira-update", {
        status: "complete",
        output: "Design document attached to PROJ-1042. Status updated to 'In Development'.",
      });

      // Stage 4: Dev Agent
      updateStage("dev", { status: "active" });
      try {
        const devPrompt = `You are a software development agent. Given this design document, produce implementation code with clear file structure and code snippets.\n\nOriginal Ticket: ${ticketTitle}\n\nDesign Document:\n${designOutput}\n\nProduce implementation code covering the key components. Include file paths, imports, and working code.`;

        const devOutput = await invokeAgent(agentIds.dev, devPrompt, "dev");
        updateStage("dev", {
          status: "complete",
          output: devOutput || "(Dev agent returned empty response)",
          skill: inferDevSkill(ticketTitle),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateStage("dev", { status: "error", error: msg });
        throw err;
      }

      // Stage 5: Complete (mocked)
      updateStage("complete", { status: "active" });
      await delay(1500);
      updateStage("complete", {
        status: "complete",
        output: "PR #347 opened on main. Jira PROJ-1042 moved to 'Code Review'.",
      });
    } catch {
      // Pipeline stopped at error stage
    } finally {
      setIsRunning(false);
    }
  }

  function resetPipeline() {
    abortRef.current?.abort();
    setStages(INITIAL_STAGES);
    setIsRunning(false);
  }

  function selectSampleTicket(ticket: SampleTicket) {
    setTicketNumber(ticket.ticketId);
    setTicketTitle(ticket.title);
    setTicketDescription(ticket.description);
    setSelectedTicket(ticket);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Routing Pipeline</h1>
        <p className="text-gray-400 mt-1">
          End-to-end demo: Jira intake → Design Agent → Jira update → Dev Agent → PR &amp; Close
        </p>
      </div>

      {/* Sample Tickets */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Sample Tickets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SAMPLE_TICKETS.map((ticket, idx) => (
            <button
              key={idx}
              onClick={() => selectSampleTicket(ticket)}
              disabled={isRunning}
              className={cn(
                "text-left p-4 rounded-lg border transition-all",
                selectedTicket === ticket
                  ? "bg-brand-600/10 border-brand-500/50 ring-1 ring-brand-500/30"
                  : "bg-surface-2 border-surface-4 hover:border-gray-600 hover:bg-surface-3",
                isRunning && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-semibold text-brand-400">{ticket.ticketId}</span>
              </div>
              <p className="text-sm font-medium text-white">{ticket.title}</p>
              <div className="flex gap-2 mt-2">
                {ticket.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-surface-1 text-gray-400 border border-surface-4"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ticket Input */}
      <div className="bg-surface-2 rounded-xl border border-surface-4 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Ticket Details
        </h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Ticket # (e.g. PROJ-1042)"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value.toUpperCase())}
              disabled={isRunning}
              className="w-48 bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 disabled:opacity-50 font-mono"
            />
            <input
              type="text"
              placeholder="Ticket title..."
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              disabled={isRunning}
              className="flex-1 bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 disabled:opacity-50"
            />
          </div>
          <textarea
            placeholder="Ticket description..."
            value={ticketDescription}
            onChange={(e) => setTicketDescription(e.target.value)}
            disabled={isRunning}
            rows={4}
            className="w-full bg-surface-1 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none disabled:opacity-50"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={runPipeline}
            disabled={isRunning || !ticketTitle.trim() || !ticketDescription.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Start Flow
          </button>
          {isRunning && (
            <button
              onClick={resetPipeline}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="space-y-0">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Pipeline
        </h2>
        <div className="relative">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="relative">
              {/* Connector line */}
              {idx < stages.length - 1 && (
                <div className="absolute left-[1.125rem] top-14 bottom-0 w-px bg-surface-4 z-0">
                  {stage.status === "complete" && (
                    <div className="absolute inset-0 bg-green-500/40" />
                  )}
                </div>
              )}

              {/* Stage Card */}
              <div
                className={cn(
                  "relative z-10 flex gap-4 p-4 rounded-xl border transition-all mb-3",
                  stage.status === "active"
                    ? "bg-brand-600/5 border-brand-500/40 shadow-lg shadow-brand-500/5"
                    : stage.status === "complete"
                    ? "bg-surface-2 border-green-500/20"
                    : stage.status === "error"
                    ? "bg-red-600/5 border-red-500/30"
                    : "bg-surface-2 border-surface-4"
                )}
              >
                {/* Status + Icon */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <StatusIcon status={stage.status} />
                  <stage.icon
                    className={cn(
                      "w-4 h-4 mt-1",
                      stage.status === "active"
                        ? "text-brand-400"
                        : stage.status === "complete"
                        ? "text-green-400"
                        : stage.status === "error"
                        ? "text-red-400"
                        : "text-gray-600"
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3
                      className={cn(
                        "font-medium text-sm",
                        stage.status === "active"
                          ? "text-brand-300"
                          : stage.status === "complete"
                          ? "text-green-300"
                          : stage.status === "error"
                          ? "text-red-300"
                          : "text-gray-500"
                      )}
                    >
                      {stage.label}
                    </h3>
                    {stage.skill && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        <Sparkles className="w-3 h-3" />
                        {stage.skill}
                      </span>
                    )}
                  </div>

                  {/* Active: show loading */}
                  {stage.status === "active" && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-xs text-brand-300">
                        <div className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </div>
                    </div>
                  )}

                  {/* Complete: show output */}
                  {stage.status === "complete" && stage.output && (
                    <div className="mt-3">
                      <div className="bg-surface-1 rounded-lg border border-surface-4 p-3 max-h-64 overflow-y-auto">
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {stage.output}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {stage.status === "error" && stage.error && (
                    <div className="mt-3">
                      <div className="bg-red-600/10 rounded-lg border border-red-500/20 p-3">
                        <p className="text-xs text-red-300">{stage.error}</p>
                      </div>
                    </div>
                  )}

                  {/* Complete stage extras */}
                  {stage.id === "complete" && stage.status === "complete" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-3">
                        <a
                          href="#"
                          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          <GitPullRequest className="w-3.5 h-3.5" />
                          PR #347
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="#"
                          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          {ticketNumber || "PROJ-1042"}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Link
                          href="/tickets"
                          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                          View in Ticket History
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      {(lastSessionIds.design || lastSessionIds.dev) && (
                        <div className="text-xs text-gray-500 font-mono space-y-0.5">
                          {lastSessionIds.design && <div>Design: {lastSessionIds.design.slice(0, 50)}...</div>}
                          {lastSessionIds.dev && <div>Dev: {lastSessionIds.dev.slice(0, 50)}...</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow between stages */}
              {idx < stages.length - 1 && stage.status === "complete" && (
                <div className="flex justify-center -my-1 relative z-10">
                  <ArrowDown className="w-4 h-4 text-green-500/50" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Skill inference (demo heuristics) ---

function inferSkill(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("ios") || lower.includes("push") || lower.includes("notification"))
    return "ios-architecture";
  if (lower.includes("rate limit") || lower.includes("api"))
    return "backend-systems";
  if (lower.includes("gdpr") || lower.includes("privacy") || lower.includes("export"))
    return "privacy-compliance";
  if (lower.includes("spanish") || lower.includes("language") || lower.includes("i18n"))
    return "localization";
  return "general-design";
}

function inferDevSkill(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("ios") || lower.includes("push") || lower.includes("notification"))
    return "swift-development";
  if (lower.includes("rate limit") || lower.includes("api"))
    return "node-typescript";
  if (lower.includes("gdpr") || lower.includes("privacy") || lower.includes("export"))
    return "data-services";
  if (lower.includes("spanish") || lower.includes("language") || lower.includes("i18n"))
    return "i18n-tooling";
  return "full-stack";
}
