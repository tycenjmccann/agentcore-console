"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils";

export interface ActivityEvent {
  id: string;
  type: "success" | "error" | "info" | "warning";
  description: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  workflowId?: string;
  workflowName?: string;
}

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    textColor: "text-green-400",
    bgColor: "bg-green-400/10",
    borderColor: "border-green-400/20",
  },
  error: {
    icon: XCircle,
    textColor: "text-red-400",
    bgColor: "bg-red-400/10",
    borderColor: "border-red-400/20",
  },
  info: {
    icon: Info,
    textColor: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
  },
  warning: {
    icon: AlertTriangle,
    textColor: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/20",
  },
} as const;

interface ActivityFeedItemProps {
  event: ActivityEvent;
}

export default function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  const config = TYPE_CONFIG[event.type];
  const Icon = config.icon;

  // Determine link destination
  const href = event.agentId
    ? `/agents/${event.agentId}`
    : event.workflowId
    ? `/workflow/${event.workflowId}`
    : null;

  const entityName = event.agentName || event.workflowName;

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors",
        config.bgColor,
        config.borderColor,
        href && "hover:bg-surface-3/50 cursor-pointer"
      )}
    >
      {/* Icon */}
      <div className={cn("mt-0.5 flex-shrink-0", config.textColor)}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-text-primary)] leading-snug">
          {event.description}
        </p>
        {entityName && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {event.agentId ? "Agent" : "Workflow"}: {entityName}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 mt-0.5">
        {formatTimestamp(event.timestamp)}
      </span>
    </div>
  );

  if (href) {
    return (
      <li>
        <Link href={href} className="block">
          {content}
        </Link>
      </li>
    );
  }

  return <li>{content}</li>;
}
