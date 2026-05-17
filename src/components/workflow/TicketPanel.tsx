"use client";

import type { JiraTicket, TicketStatus } from "@/lib/workflow/types";

interface TicketPanelProps {
  tickets: JiraTicket[];
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  backlog: "bg-zinc-600",
  todo: "bg-zinc-500",
  ready: "bg-yellow-500",
  in_progress: "bg-blue-500",
  in_review: "bg-purple-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  ready: "Ready",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
};

export default function TicketPanel({ tickets }: TicketPanelProps) {
  if (tickets.length === 0) return null;

  const epic = tickets.find((t) => t.type === "epic");
  const children = tickets.filter((t) => t.type !== "epic");

  const doneCount = children.filter((t) => t.status === "done").length;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Tickets</h3>
        <span className="text-xs text-zinc-500">
          {doneCount}/{children.length} done
        </span>
      </div>

      {epic && (
        <div className="mb-3 p-2 bg-zinc-800 rounded border border-zinc-600">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">{epic.id}</span>
            <span className="text-xs text-purple-400 font-medium">EPIC</span>
          </div>
          <p className="text-sm text-zinc-200 mt-1">{epic.title}</p>
        </div>
      )}

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {children.map((ticket) => (
          <div
            key={ticket.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors"
          >
            <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[ticket.status]}`} />
            <span className="text-xs font-mono text-zinc-500 w-16 shrink-0">
              {ticket.id}
            </span>
            <span className="text-xs text-zinc-300 truncate flex-1">
              {ticket.title}
            </span>
            <span className="text-[10px] text-zinc-500">
              {STATUS_LABELS[ticket.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
