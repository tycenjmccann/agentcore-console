"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Clock,
  MessageSquare,
  Database,
  Terminal,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  sessionId: string;
  actorId: string;
  createdAt: string;
}

interface MemoryOption {
  id: string;
  status: string;
}

interface CollapsibleHistorySidebarProps {
  sessions: Session[];
  traceSessions: Session[];
  sessionSource: "memory" | "traces";
  setSessionSource: (source: "memory" | "traces") => void;
  loadingSessions: boolean;
  currentSessionId: string;
  linkedMemory: string;
  availableMemories: MemoryOption[];
  hasMemory: boolean;
  onNewSession: () => void;
  onResumeSession: (session: Session) => void;
  onResumeTraceSession: (session: Session) => void;
  onMemoryChange: (memoryId: string) => void;
}

export default function CollapsibleHistorySidebar({
  sessions,
  traceSessions,
  sessionSource,
  setSessionSource,
  loadingSessions,
  currentSessionId,
  linkedMemory,
  availableMemories,
  hasMemory,
  onNewSession,
  onResumeSession,
  onResumeTraceSession,
  onMemoryChange,
}: CollapsibleHistorySidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("history-sidebar-collapsed") === "true";
    }
    return false;
  });

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem("history-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  function timeAgo(dateStr: string): string {
    if (!dateStr) return "";
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  const activeSessions = sessionSource === "memory" ? sessions : traceSessions;

  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 flex flex-col items-center border-r border-surface-4 pr-0 py-2 gap-2">
        <button
          onClick={toggleCollapsed}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-3 text-gray-500 hover:text-gray-300 transition-colors"
          title="Expand session history"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <button
          onClick={onNewSession}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-600/20 border border-brand-600/30 text-brand-400 hover:bg-brand-600/30 transition-colors"
          title="New Session"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="w-6 border-t border-surface-4 my-1" />

        {/* Compact session indicators */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 w-full px-1">
          {activeSessions.slice(0, 8).map((session) => (
            <button
              key={session.sessionId}
              onClick={() =>
                sessionSource === "memory"
                  ? onResumeSession(session)
                  : onResumeTraceSession(session)
              }
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0",
                currentSessionId === session.sessionId
                  ? "bg-brand-600/20 border border-brand-600/30 text-brand-300"
                  : "hover:bg-surface-3 text-gray-500"
              )}
              title={`${session.sessionId.slice(0, 16)}... • ${timeAgo(session.createdAt)}`}
            >
              {sessionSource === "memory" ? (
                <MessageSquare className="w-3 h-3" />
              ) : (
                <Terminal className="w-3 h-3" />
              )}
            </button>
          ))}
          {activeSessions.length > 8 && (
            <span className="text-[9px] text-gray-600 mt-1">+{activeSessions.length - 8}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 flex flex-col border-r border-surface-4 pr-3">
      {/* Collapse toggle + New Session */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={toggleCollapsed}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-3 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          title="Collapse session history"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
        <button
          onClick={onNewSession}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600/20 border border-brand-600/30 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          New Session
        </button>
      </div>

      {/* Source Toggle */}
      <div className="flex items-center gap-1 mb-2 p-0.5 bg-surface-3 rounded-lg">
        <button
          onClick={() => setSessionSource("memory")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
            sessionSource === "memory"
              ? "bg-surface-1 text-brand-400 shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Database className="w-2.5 h-2.5" />
          Memory
        </button>
        <button
          onClick={() => setSessionSource("traces")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
            sessionSource === "traces"
              ? "bg-surface-1 text-brand-400 shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Terminal className="w-2.5 h-2.5" />
          Traces
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1">
          {sessionSource === "memory" ? "History" : "Trace Sessions"}
        </p>
        {loadingSessions ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
          </div>
        ) : activeSessions.length === 0 ? (
          <p className="text-xs text-gray-600 py-2">
            {sessionSource === "memory" ? "No previous sessions" : "No trace sessions found"}
          </p>
        ) : (
          activeSessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() =>
                sessionSource === "memory"
                  ? onResumeSession(session)
                  : onResumeTraceSession(session)
              }
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors group",
                currentSessionId === session.sessionId
                  ? "bg-brand-600/20 border border-brand-600/30 text-brand-300"
                  : "hover:bg-surface-3 text-gray-400 border border-transparent"
              )}
            >
              <div className="flex items-center gap-1.5">
                {sessionSource === "memory" ? (
                  <MessageSquare className="w-2.5 h-2.5 flex-shrink-0" />
                ) : (
                  <Terminal className="w-2.5 h-2.5 flex-shrink-0" />
                )}
                <span className="truncate font-mono text-[10px]">
                  {session.sessionId.length > 16
                    ? session.sessionId.slice(0, 16) + "..."
                    : session.sessionId}
                </span>
                <ChevronRight className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-600" />
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-gray-600 text-[10px]">
                <Clock className="w-2 h-2" />
                <span>{timeAgo(session.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Memory Selector */}
      {hasMemory && (
        <div className="mt-3 pt-3 border-t border-surface-4">
          <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1 mb-1.5">
            <Database className="w-3 h-3" /> Memory
          </label>
          <select
            value={linkedMemory}
            onChange={(e) => onMemoryChange(e.target.value)}
            className="w-full bg-surface-3 border border-surface-4 rounded-lg px-2 py-1.5 text-[10px] text-gray-300 font-mono focus:outline-none focus:border-brand-600/50"
          >
            <option value="">None</option>
            {availableMemories.map((mem) => (
              <option key={mem.id} value={mem.id}>
                {mem.id.replace(/-[A-Za-z0-9]{10,}$/, "")}
              </option>
            ))}
          </select>
          {linkedMemory && (
            <p className="text-[9px] text-gray-600 mt-1 truncate">{linkedMemory}</p>
          )}
        </div>
      )}
    </div>
  );
}
