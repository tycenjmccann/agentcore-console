"use client";

import { useState } from "react";
import { usePipelineState } from "./usePipelineState";
import PipelineCanvas from "./PipelineCanvas";
import TicketPanel from "./TicketPanel";
import AgentOutput from "./AgentOutput";

interface PipelineVisualizationProps {
  workflowId: string;
}

export default function PipelineVisualization({ workflowId }: PipelineVisualizationProps) {
  const {
    workflowState,
    tickets,
    messages,
    streamingText,
    isInitialLoad,
    isCelebrating,
  } = usePipelineState(workflowId);

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  if (!workflowState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          <span className="text-zinc-400 text-sm">Loading pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline canvas */}
      <PipelineCanvas
        currentPhase={workflowState.phase}
        agentTasks={workflowState.agentTasks}
        streamingText={streamingText}
        isCelebrating={isCelebrating}
        suppressAnimation={isInitialLoad}
        onAgentExpand={setExpandedAgent}
      />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TicketPanel tickets={tickets} />
        <MessagePanel messages={messages} />
      </div>

      {/* Workflow complete celebration summary */}
      {workflowState.phase === "complete" && (
        <div className={`
          rounded-lg p-4 border
          ${isCelebrating
            ? "bg-orange-500/10 border-orange-500/40"
            : "bg-green-900/20 border-green-700/50"
          }
          ${!isInitialLoad ? "transition-all duration-500" : ""}
        `}>
          <h3 className={`text-sm font-semibold mb-2 ${
            isCelebrating ? "text-orange-300" : "text-green-300"
          }`}>
            {isCelebrating ? "🎉 Workflow Complete!" : "✅ Workflow Complete"}
          </h3>
          <div className="space-y-1 text-xs text-zinc-300">
            <p>Started: {workflowState.startedAt ? new Date(workflowState.startedAt).toLocaleString() : "N/A"}</p>
            <p>Completed: {workflowState.completedAt ? new Date(workflowState.completedAt).toLocaleString() : "N/A"}</p>
            <p>Agents involved: {Object.keys(workflowState.agentTasks).length}</p>
            {Object.values(workflowState.agentTasks).some((t) => t.branch) && (
              <div className="mt-2">
                <p className="text-green-400 font-medium">Branches:</p>
                {Object.values(workflowState.agentTasks)
                  .filter((t) => t.branch)
                  .map((t) => (
                    <p key={t.id} className="font-mono text-green-300 pl-2">
                      {t.branch} {t.commitSha ? `(${t.commitSha.slice(0, 7)})` : ""}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {workflowState.phase === "error" && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-300 mb-1">Workflow Error</h3>
          <p className="text-xs text-red-400">{workflowState.error || "Unknown error"}</p>
        </div>
      )}

      {/* Expanded agent output modal */}
      {expandedAgent && (
        <AgentOutput
          agentId={expandedAgent}
          output={workflowState.agentTasks[expandedAgent]?.output || streamingText[expandedAgent] || ""}
          isStreaming={!!streamingText[expandedAgent]}
          onClose={() => setExpandedAgent(null)}
        />
      )}
    </div>
  );
}

/** Simple message panel for agent-to-agent messages */
function MessagePanel({ messages }: { messages: { id: string; from: string; to: string; content: string; timestamp: string }[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="bg-surface-1 border border-surface-4 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Agent Messages</h3>
      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
        {messages.slice(-20).map((msg) => (
          <div key={msg.id} className="text-xs border-l-2 border-surface-4 pl-2 py-1">
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="font-medium text-zinc-400">{msg.from}</span>
              <span>→</span>
              <span>{msg.to}</span>
              <span className="ml-auto text-[10px]">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-zinc-300 mt-0.5 line-clamp-2">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
