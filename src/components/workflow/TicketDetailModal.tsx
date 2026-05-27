"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Crown,
  BookOpen,
  CheckSquare,
  Check,
  Circle,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";
import type { JiraTicket, TicketStatus, TicketType } from "@/lib/workflow/types";

// ─── Props ──────────────────────────────────────────────────────────────────

interface TicketDetailModalProps {
  ticketId: string;
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TICKET_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; border: string; label: string }> = {
  backlog:     { bg: "bg-zinc-800/60", text: "text-zinc-400", dot: "bg-zinc-500", border: "border-zinc-700", label: "Backlog" },
  todo:        { bg: "bg-zinc-800/60", text: "text-zinc-400", dot: "bg-zinc-500", border: "border-zinc-700", label: "To Do" },
  ready:       { bg: "bg-zinc-800/80", text: "text-zinc-300", dot: "bg-zinc-400", border: "border-zinc-600", label: "Ready" },
  in_progress: { bg: "bg-blue-900/30", text: "text-blue-400", dot: "bg-blue-500", border: "border-blue-500/40", label: "In Progress" },
  in_review:   { bg: "bg-blue-900/30", text: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/40", label: "In Review" },
  done:        { bg: "bg-green-900/30", text: "text-green-400", dot: "bg-green-500", border: "border-green-500/50", label: "Done" },
  blocked:     { bg: "bg-red-900/30", text: "text-red-400", dot: "bg-red-400", border: "border-red-500/60", label: "Blocked" },
  cancelled:   { bg: "bg-zinc-900/40", text: "text-zinc-600", dot: "bg-zinc-700", border: "border-zinc-800", label: "Cancelled" },
};

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  backlog:     ["todo"],
  todo:        ["ready", "cancelled"],
  ready:       ["in_progress", "cancelled"],
  in_progress: ["in_review", "blocked", "cancelled"],
  in_review:   ["done", "in_progress", "blocked"],
  blocked:     ["in_progress", "cancelled"],
  done:        [],
  cancelled:   ["todo"],
};

const TYPE_ICONS: Record<TicketType, typeof Crown> = {
  epic: Crown,
  story: BookOpen,
  task: CheckSquare,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAgentName(agentId: string): string {
  return agentId
    .replace(/^team-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const style = TICKET_STATUS_STYLES[status] || TICKET_STATUS_STYLES.backlog;
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return <div className={`h-3 ${width} bg-zinc-700/40 rounded animate-pulse`} />;
}

function SkeletonBlock() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-zinc-700/40 rounded animate-pulse" />
        <SkeletonLine width="w-24" />
        <SkeletonLine width="w-48" />
      </div>
      <SkeletonLine width="w-32" />
      <SkeletonLine />
      <SkeletonLine width="w-3/4" />
      <div className="pt-4 space-y-3">
        <SkeletonLine width="w-40" />
        <SkeletonLine />
        <SkeletonLine width="w-2/3" />
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TicketDetailModal({
  ticketId,
  workflowId,
  isOpen,
  onClose,
}: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<JiraTicket | null>(null);
  const [allTickets, setAllTickets] = useState<JiraTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Transition state
  const [pendingTransition, setPendingTransition] = useState<TicketStatus | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionSuccess, setTransitionSuccess] = useState(false);

  // Children section
  const [childrenExpanded, setChildrenExpanded] = useState(false);

  // Announcement for aria-live
  const [announcement, setAnnouncement] = useState("");

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Mount tracking for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch tickets on open
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setTicket(null);
    setPendingTransition(null);
    setTransitionError(null);
    setTransitionSuccess(false);

    fetch(`/api/workflow/${workflowId}/tickets`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { tickets: JiraTicket[] }) => {
        const tickets = data.tickets ?? [];
        setAllTickets(tickets);
        const found = tickets.find((t) => t.id === ticketId);
        if (found) {
          setTicket(found);
        } else {
          setError(`Ticket ${ticketId} not found`);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load ticket");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, workflowId, ticketId]);

  // Focus close button on open
  useEffect(() => {
    if (isOpen && !isClosing) {
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
  }, [isOpen, isClosing]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || isClosing) return;
    const modal = modalRef.current;
    if (!modal) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isClosing]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/workflow/${workflowId}/tickets`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { tickets: JiraTicket[] }) => {
        const tickets = data.tickets ?? [];
        setAllTickets(tickets);
        const found = tickets.find((t) => t.id === ticketId);
        if (found) {
          setTicket(found);
        } else {
          setError(`Ticket ${ticketId} not found`);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load ticket");
        setIsLoading(false);
      });
  }, [workflowId, ticketId]);

  const handleTransitionConfirm = useCallback(async () => {
    if (!pendingTransition || !ticket) return;
    setIsTransitioning(true);
    setTransitionError(null);

    try {
      const res = await fetch(`/api/workflow/${workflowId}/tickets/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          targetStatus: pendingTransition,
          comment: transitionComment || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const newStatus = data.status ?? pendingTransition;
      setTicket((prev) => prev ? { ...prev, status: newStatus } : prev);
      setTransitionSuccess(true);
      setAnnouncement(`Ticket transitioned to ${TICKET_STATUS_STYLES[newStatus]?.label ?? newStatus}`);
      setTimeout(() => setTransitionSuccess(false), 1200);
      setPendingTransition(null);
      setTransitionComment("");
      setShowCommentInput(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transition failed";
      setTransitionError(message);
    } finally {
      setIsTransitioning(false);
    }
  }, [pendingTransition, ticket, transitionComment, workflowId]);

  const handleTransitionCancel = useCallback(() => {
    setPendingTransition(null);
    setTransitionComment("");
    setShowCommentInput(false);
    setTransitionError(null);
  }, []);

  // Resolve blockers
  const blockers = ticket
    ? ticket.blockedBy.map((id) => allTickets.find((t) => t.id === id)).filter(Boolean) as JiraTicket[]
    : [];
  const resolvedBlockers = blockers.filter((b) => b.status === "done" || b.status === "cancelled");
  const blockerProgress = blockers.length > 0 ? Math.round((resolvedBlockers.length / blockers.length) * 100) : 100;

  // Resolve children
  const children = ticket
    ? ticket.children.map((id) => allTickets.find((t) => t.id === id)).filter(Boolean) as JiraTicket[]
    : [];

  // Valid transitions for current status
  const validTransitions = ticket ? VALID_TRANSITIONS[ticket.status] ?? [] : [];

  if (!mounted || !isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 ${isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-modal-title"
        className={`relative z-[201] w-full max-w-2xl mx-4 max-h-[85vh] bg-[#1a2332] border border-[#1e293b] rounded-xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? "modal-card-exit" : "modal-card-enter"} ${transitionSuccess ? "animate-ticket-transition-success" : ""}`}
      >
        {/* ARIA live region */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e293b] shrink-0">
          {ticket && (() => {
            const TypeIcon = TYPE_ICONS[ticket.type];
            return <TypeIcon size={18} className="text-[#94a3b8] shrink-0" />;
          })()}
          {ticket && (
            <span className="font-mono text-[12px] text-[#94a3b8] shrink-0">{ticket.id}</span>
          )}
          <h2 id="ticket-modal-title" className="text-[15px] font-semibold text-[#e2e8f0] truncate flex-1">
            {ticket?.title ?? "Loading..."}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-[rgba(100,116,139,0.2)] text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
            aria-label="Close ticket detail"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {isLoading && <SkeletonBlock />}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <p className="text-[13px] text-zinc-400">Failed to load ticket</p>
              <p className="text-[11px] text-zinc-600 mt-1">{error}</p>
              <button
                onClick={retry}
                className="mt-3 text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                type="button"
              >
                Try again
              </button>
            </div>
          )}

          {/* Ticket content */}
          {!isLoading && !error && ticket && (
            <div className="p-6 space-y-5">
              {/* Status row */}
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={ticket.status} />
                <div className="flex items-center gap-2">
                  {validTransitions.length === 0 ? (
                    <span className="text-[11px] text-zinc-500 italic">Status is final</span>
                  ) : pendingTransition ? null : (
                    <select
                      className="bg-[#0f1419] border border-[#1e293b] rounded-md px-2 py-1 text-[11px] text-[#e2e8f0] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setPendingTransition(e.target.value as TicketStatus);
                          setTransitionError(null);
                        }
                      }}
                      disabled={isTransitioning}
                    >
                      <option value="">Transition to...</option>
                      {validTransitions.map((s) => (
                        <option key={s} value={s}>
                          {TICKET_STATUS_STYLES[s]?.label ?? s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Transition confirmation */}
              {pendingTransition && (
                <div className="bg-[#0f1419] border border-[#1e293b] rounded-lg p-3 space-y-2">
                  <p className="text-[12px] text-[#e2e8f0]">
                    Transition to <strong>{TICKET_STATUS_STYLES[pendingTransition]?.label ?? pendingTransition}</strong>?
                  </p>
                  {showCommentInput ? (
                    <textarea
                      className="w-full bg-[#1a2332] border border-[#1e293b] rounded-md px-3 py-2 text-[12px] text-[#e2e8f0] resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={2}
                      placeholder="Add a comment..."
                      value={transitionComment}
                      onChange={(e) => setTransitionComment(e.target.value)}
                      disabled={isTransitioning}
                    />
                  ) : (
                    <button
                      onClick={() => setShowCommentInput(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      type="button"
                      disabled={isTransitioning}
                    >
                      Add comment
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTransitionConfirm}
                      disabled={isTransitioning}
                      className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-medium transition-colors flex items-center gap-1.5"
                      type="button"
                    >
                      {isTransitioning && <Loader2 size={12} className="animate-spin" />}
                      Confirm
                    </button>
                    <button
                      onClick={handleTransitionCancel}
                      disabled={isTransitioning}
                      className="px-3 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-[11px] font-medium transition-colors"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                  {transitionError && (
                    <p className="text-[11px] text-red-400 mt-1">{transitionError}</p>
                  )}
                </div>
              )}

              {/* Assignee */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Assignee</p>
                <p className="text-[13px] text-[#e2e8f0]">
                  {ticket.assignee ? formatAgentName(ticket.assignee) : "Unassigned"}
                </p>
              </div>

              {/* Description */}
              {ticket.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Description</p>
                  <p className="text-[12px] text-[#94a3b8] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {ticket.description}
                  </p>
                </div>
              )}

              {/* Dependencies */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Blocked By</p>
                  <span className="text-[10px] text-zinc-600">({blockers.length})</span>
                </div>
                {blockers.length === 0 ? (
                  <div className="flex items-center gap-2 text-[12px] text-green-400">
                    <Check size={14} />
                    <span>No dependencies</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Progress bar */}
                    <div className="relative">
                      <div
                        className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={blockerProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${resolvedBlockers.length} of ${blockers.length} blockers resolved`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            blockerProgress === 100
                              ? "bg-green-500"
                              : blockerProgress >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${blockerProgress}%` }}
                        />
                      </div>
                    </div>
                    {/* Blocker list */}
                    <ul className="space-y-1.5">
                      {blockers.map((b) => {
                        const resolved = b.status === "done" || b.status === "cancelled";
                        return (
                          <li key={b.id} className="flex items-center gap-2">
                            {resolved ? (
                              <Check size={14} className="text-green-400 shrink-0" />
                            ) : (
                              <Circle size={14} className="text-zinc-600 shrink-0" />
                            )}
                            <span className="font-mono text-[11px] text-zinc-500 shrink-0">{b.id}</span>
                            <span className="text-[12px] text-[#94a3b8] truncate flex-1">{b.title}</span>
                            <StatusBadge status={b.status} size="sm" />
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-zinc-500">
                      {resolvedBlockers.length} of {blockers.length} blockers resolved
                    </p>
                  </div>
                )}
              </div>

              {/* Children */}
              {children.length > 0 && (
                <div>
                  <button
                    onClick={() => setChildrenExpanded(!childrenExpanded)}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
                    type="button"
                  >
                    {childrenExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Children ({children.length})
                  </button>
                  {childrenExpanded && (
                    <ul className="space-y-1.5 pl-1">
                      {children.map((child) => {
                        const dotStyle = TICKET_STATUS_STYLES[child.status] || TICKET_STATUS_STYLES.backlog;
                        return (
                          <li key={child.id} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${dotStyle.dot} shrink-0`} />
                            <span className="font-mono text-[11px] text-zinc-500 shrink-0">{child.id}</span>
                            <span className="text-[12px] text-[#94a3b8] truncate">{child.title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Comments */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Comments</p>
                {ticket.comments.length === 0 ? (
                  <p className="text-[12px] text-zinc-600 italic">No comments yet</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {ticket.comments.map((comment) => (
                      <div key={comment.id} className="text-[12px]">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[#e2e8f0]">
                            {formatAgentName(comment.author)}
                          </span>
                          <span className="text-zinc-600 text-[10px]">
                            {formatRelativeTime(comment.timestamp)}
                          </span>
                        </div>
                        <p className="text-[#94a3b8]">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Artifacts */}
              {ticket.artifacts.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Artifacts</p>
                  <ul className="space-y-1">
                    {ticket.artifacts.map((artifact) => (
                      <li key={artifact.id} className="flex items-center gap-2">
                        <LinkIcon size={12} className="text-zinc-600 shrink-0" />
                        <span className="text-[12px] text-blue-400 hover:text-blue-300 cursor-pointer truncate">
                          {artifact.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
