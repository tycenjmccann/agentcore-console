"use client";

import WorkflowBoard from "@/components/workflow/WorkflowBoard";

export default function WorkflowDemoPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Workflow Demo</h2>
        <p className="text-sm text-gray-400">
          Demonstration of the WorkflowBoard component with model display in the header.
        </p>
      </div>
      
      <WorkflowBoard workflowId="wf_demo_123" />
    </div>
  );
}
