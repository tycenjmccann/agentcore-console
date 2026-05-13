import { clsx, type ClassValue } from "clsx";
import { TaskStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "COMPLETED":
      return "text-green-400";
    case "RUNNING":
    case "HYDRATING":
    case "FINALIZING":
      return "text-blue-400";
    case "SUBMITTED":
      return "text-yellow-400";
    case "FAILED":
      return "text-red-400";
    case "CANCELLED":
      return "text-gray-400";
    default:
      return "text-gray-400";
  }
}

export function getStatusBg(status: TaskStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-400/10 border-green-400/30";
    case "RUNNING":
    case "HYDRATING":
    case "FINALIZING":
      return "bg-blue-400/10 border-blue-400/30";
    case "SUBMITTED":
      return "bg-yellow-400/10 border-yellow-400/30";
    case "FAILED":
      return "bg-red-400/10 border-red-400/30";
    case "CANCELLED":
      return "bg-gray-400/10 border-gray-400/30";
    default:
      return "bg-gray-400/10 border-gray-400/30";
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
