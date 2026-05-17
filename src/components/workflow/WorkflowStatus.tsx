"use client";

import { cn } from "@/lib/utils";
import type { WorkflowPhase, AgentTaskStatus } from "@/lib/workflow/types";
import {
  Clock,
  MessageSquare,
  GitBranch,
  Bot,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Loader2,
} from "lucide-react";

// Phase configuration for display
export const phaseConfig: Record<WorkflowPhase, { 
  label: string; 
  color: string; 
  bgColor: string;
  borderColor: string;
  icon: typeof Play;
}> = {
  intake: { 
    label: "Intake", 
    color: "text-blue-400", 
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    icon: Clock,
  },
  requirements: { 
    label: "Requirements", 
    color: "text-purple-400", 
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    icon: MessageSquare,
  },
  design: { 
    label: "Design", 
    color: "text-cyan-400", 
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    icon: GitBranch,
  },
  development: { 
    label: "Development", 
    color: "text-green-400", 
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: Bot,
  },
  review: { 
    label: "Review", 
    color: "text-yellow-400", 
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: CheckCircle2,
  },
  complete: { 
    label: "Complete", 
    color: "text-emerald-400", 
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  error: { 
    label: "Error", 
    color: "text-red-400", 
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: AlertCircle,
  },
};

// Task status configuration
export const taskStatusConfig: Record<AgentTaskStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  pending: {
    label: "Pending",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
  },
  running: {
    label: "Running",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  waiting_response: {
    label: "Waiting",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  complete: {
    label: "Complete",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  error: {
    label: "Error",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
};

// Phase badge component
interface PhaseBadgeProps {
  phase: WorkflowPhase;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function PhaseBadge({ phase, size = "md", showIcon = true }: PhaseBadgeProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-medium rounded-full border",
      config.bgColor,
      config.color,
      config.borderColor,
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
    )}>
      {showIcon && <Icon className={cn(size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3")} />}
      {config.label}
    </span>
  );
}

// Task status badge component
interface TaskStatusBadgeProps {
  status: AgentTaskStatus;
  size?: "sm" | "md";
  animated?: boolean;
}

export function TaskStatusBadge({ status, size = "md", animated = true }: TaskStatusBadgeProps) {
  const config = taskStatusConfig[status];
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-medium rounded border",
      config.bgColor,
      config.color,
      config.borderColor,
      size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
    )}>
      {status === "running" && animated && (
        <Loader2 className={cn(
          "animate-spin",
          size === "sm" ? "w-2 h-2" : "w-3 h-3"
        )} />
      )}
      {config.label}
    </span>
  );
}

// Task status dot indicator
interface TaskStatusDotProps {
  status: AgentTaskStatus;
  size?: "sm" | "md";
}

export function TaskStatusDot({ status, size = "md" }: TaskStatusDotProps) {
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  
  return (
    <div className={cn(
      "rounded-full",
      dotSize,
      status === "running" && "bg-green-400 animate-pulse",
      status === "waiting_response" && "bg-yellow-400 animate-pulse",
      status === "complete" && "bg-emerald-400",
      status === "error" && "bg-red-400",
      status === "pending" && "bg-gray-600"
    )} />
  );
}

// Phase progress bar
interface PhaseProgressProps {
  currentPhase: WorkflowPhase;
  size?: "sm" | "md";
}

const phaseOrder: WorkflowPhase[] = [
  "intake",
  "requirements", 
  "design",
  "development",
  "review",
  "complete",
];

export function PhaseProgress({ currentPhase, size = "md" }: PhaseProgressProps) {
  const currentIndex = currentPhase === "error" 
    ? -1 
    : phaseOrder.indexOf(currentPhase);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {phaseOrder.map((phase, idx) => {
          const isPast = currentIndex > idx;
          const isCurrent = currentIndex === idx;
          const config = phaseConfig[phase];
          
          return (
            <div key={phase} className="flex-1 flex items-center">
              <div className={cn(
                "flex-1 rounded-full transition-colors",
                size === "sm" ? "h-1" : "h-1.5",
                isPast && "bg-emerald-500",
                isCurrent && `${config.bgColor.replace('/10', '/40')} animate-pulse`,
                !isPast && !isCurrent && "bg-surface-3"
              )} />
              {idx < phaseOrder.length - 1 && <div className="w-0.5" />}
            </div>
          );
        })}
      </div>
      {size === "md" && (
        <div className="flex justify-between text-xs text-gray-500">
          {phaseOrder.map((phase) => (
            <span 
              key={phase} 
              className={cn(
                currentPhase === phase && "text-white font-medium"
              )}
            >
              {phaseConfig[phase].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Time helpers
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}
