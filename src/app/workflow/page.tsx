"use client";

import { useState, useEffect } from "react";
import PipelineVisualization from "@/components/workflow/PipelineVisualization";
import type { WorkflowState } from "@/lib/workflow/types";
import "@/styles/pipeline.css";

/**
 * Workflow Pipeline page - displays the animated multi-agent pipeline.
 * Polls the workflow API for state updates and passes them to the visualization.
 */
export default function WorkflowPage() {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflowState();
    const interval = setInterval(fetchWorkflowState, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchWorkflowState() {
    try {
      const res = await fetch("/api/workflow/state");
      if (!res.ok) {
        // If no workflow exists yet, show intake state
        if (res.status === 404) {
          setWorkflowState(null);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch workflow state: ${res.status}`);
      }
      const data = await res.json();
      setWorkflowState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleStepClick(phaseId: string, itemId: string) {
    console.log(`[Pipeline] Clicked phase=${phaseId} item=${itemId}`);
    // Future: open detail panel for the clicked step
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-gray-500 text-sm">Loading pipeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="-m-6">
      <PipelineVisualization
        workflowState={workflowState}
        onStepClick={handleStepClick}
      />
    </div>
  );
}
