"use client";

interface AgentOutputProps {
  agentId: string;
  output: string;
  isStreaming?: boolean;
  onClose: () => void;
}

export default function AgentOutput({ agentId, output, isStreaming, onClose }: AgentOutputProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          {agentId} {isStreaming && <span className="text-green-400 animate-pulse">●</span>}
        </h3>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          Close
        </button>
      </div>
      <pre className="text-xs text-zinc-300 whitespace-pre-wrap max-h-96 overflow-y-auto font-mono leading-relaxed">
        {output || "Waiting for output..."}
      </pre>
    </div>
  );
}
