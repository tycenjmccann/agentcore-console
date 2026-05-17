"use client";

import * as React from "react";
import { ModelSelector } from "@/components/workflow/ModelSelector";
import { ModelConfig, WorkflowState } from "@/types/model";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface IntakeFormProps {
  onSubmit: (state: WorkflowState) => void;
  initialState?: Partial<WorkflowState>;
  className?: string;
}

export function IntakeForm({ onSubmit, initialState, className }: IntakeFormProps) {
  const [workflowState, setWorkflowState] = React.useState<WorkflowState>({
    workflowId: initialState?.workflowId,
    status: initialState?.status || "draft",
    modelConfig: initialState?.modelConfig,
  });
  const [submitting, setSubmitting] = React.useState(false);

  const handleModelChange = (modelConfig: ModelConfig) => {
    setWorkflowState((prev) => ({
      ...prev,
      modelConfig,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(workflowState);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      <div className="card">
        <h2 className="text-xl font-bold text-white mb-6">Workflow Configuration</h2>
        
        {/* Model Selector */}
        <div className="mb-6">
          <ModelSelector
            value={workflowState.modelConfig}
            onChange={handleModelChange}
            disabled={submitting}
          />
        </div>

        {/* Workflow Details (placeholder for other form fields) */}
        <div className="space-y-4">
          <div>
            <label htmlFor="workflow-name" className="text-sm font-medium text-gray-300 block mb-2">
              Workflow Name
            </label>
            <input
              id="workflow-name"
              type="text"
              placeholder="Enter workflow name"
              className="w-full h-10 px-3 py-2 bg-surface-2 border border-surface-4 rounded-md text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="workflow-description" className="text-sm font-medium text-gray-300 block mb-2">
              Description
            </label>
            <textarea
              id="workflow-description"
              rows={4}
              placeholder="Describe your workflow..."
              className="w-full px-3 py-2 bg-surface-2 border border-surface-4 rounded-md text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
              disabled={submitting}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Creating..." : "Create Workflow"}
          </button>
        </div>
      </div>
    </form>
  );
}
