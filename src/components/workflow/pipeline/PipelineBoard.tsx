"use client";

import { useEffect } from "react";
import { PipelineProvider, usePipeline } from "./PipelineContext";
import { PhaseNode } from "./PhaseNode";
import { PhaseConnector } from "./PhaseConnector";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { useWorkflowSSE } from "./useWorkflowSSE";
import { AlertCircle, Loader2 } from "lucide-react";

interface WorkflowBoardProps {
  workflowId: string;
}

/**
 * WorkflowBoard — Pipeline Visualization
 *
 * Drop-in replacement: <WorkflowBoard workflowId={string} />
 *
 * Shows a horizontal pipeline of phases connected by animated SVG paths.
 * Hydrates current state from REST, then applies real-time SSE updates.
 */
export function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  return (
    <PipelineProvider>
      <PipelineInner workflowId={workflowId} />
    </PipelineProvider>
  );
}

function PipelineInner({ workflowId }: { workflowId: string }) {
  const { state, dispatch } = usePipeline();

  // Hydrate initial state from REST API
  useEffect(() => {
    if (!workflowId) return;

    fetch(`/api/workflow/${workflowId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch workflow: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        dispatch({ type: "HYDRATE", payload: data });
      })
      .catch((err) => {
        dispatch({ type: "ERROR", error: err.message });
      });
  }, [workflowId, dispatch]);

  // Connect SSE after hydration
  useWorkflowSSE(workflowId);

  // Loading state
  if (!state.hydratedAt && !state.error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        <span className="ml-3 text-sm text-gray-400">Loading pipeline...</span>
      </div>
    );
  }

  // Error state
  if (state.error && !state.hydratedAt) {
    return (
      <div className="flex items-center justify-center py-20">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <span className="ml-2 text-sm text-red-300">{state.error}</span>
      </div>
    );
  }

  return (
    <div className="pipeline-container">
      {/* Horizontal pipeline */}
      <div className="pipeline-track">
        {state.phases.map((phase, idx) => (
          <div key={phase.id} className="pipeline-phase-group">
            <PhaseNode phase={phase} />
            {idx < state.phases.length - 1 && (
              <PhaseConnector
                fromStatus={phase.status}
                toStatus={state.phases[idx + 1].status}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {state.error && state.hydratedAt && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{state.error}</p>
        </div>
      )}

      {/* Celebration overlay */}
      <CelebrationOverlay />
    </div>
  );
}
