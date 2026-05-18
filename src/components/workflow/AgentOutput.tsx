"use client";

import { useEffect, useRef } from "react";

interface AgentOutputProps {
  agentId: string;
  output: string;
  isStreaming: boolean;
  onClose: () => void;
}

export default function AgentOutput({ agentId, output, isStreaming, onClose }: AgentOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output, isStreaming]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-surface-4 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200">{agentId}</span>
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs text-brand-400">
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                Streaming
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Output content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 scrollbar-thin"
        >
          {output ? (
            <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
              {output}
            </pre>
          ) : (
            <p className="text-xs text-zinc-500 italic">No output yet...</p>
          )}
        </div>
      </div>
    </div>
  );
}
