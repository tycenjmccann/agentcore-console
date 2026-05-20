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

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        "hover:bg-surface-3/50 group cursor-pointer"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
          config.bgColor
        )}
      >
        <Icon className={cn("w-4 h-4", config.textColor)} />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-text-primary)] truncate">
          {event.description}
        </p>
        {(event.agentName || event.workflowName) && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {event.agentName || event.workflowName}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 whitespace-nowrap">
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
