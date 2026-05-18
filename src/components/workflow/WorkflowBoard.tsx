"use client";

import PipelineVisualization from "./PipelineVisualization";

interface WorkflowBoardProps {
  workflowId: string;
}

/**
 * WorkflowBoard — Drop-in pipeline visualization.
 *
 * Previously rendered vertical phase columns. Now renders the animated
 * horizontal pipeline visualization with real-time SSE updates.
 *
 * Interface unchanged: <WorkflowBoard workflowId={string} />
 */
export default function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  return <PipelineVisualization workflowId={workflowId} />;
}
