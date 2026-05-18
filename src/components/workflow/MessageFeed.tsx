"use client";

import type { AgentMessage } from "@/lib/workflow/types";

interface MessageFeedProps {
  messages: AgentMessage[];
}

export default function MessageFeed({ messages }: MessageFeedProps) {
  if (messages.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
        Agent Communication
      </h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="flex gap-2 text-xs"
          >
            <span className="text-brand-400 font-mono shrink-0">
              {msg.from}
            </span>
            <span className="text-zinc-600">→</span>
            <span className="text-zinc-400 font-mono shrink-0">
              {msg.to}
            </span>
            <span className="text-zinc-300 truncate">{msg.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
