"use client";

import { Activity } from "lucide-react";

export default function ActivityFeedEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-4">
        <Activity className="w-6 h-6 text-[var(--color-text-muted)]" />
      </div>
      <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
        No activity yet
      </h4>
      <p className="text-xs text-[var(--color-text-muted)] text-center max-w-[240px]">
        Events will appear here as agents and workflows run
      </p>
    </div>
  );
}
