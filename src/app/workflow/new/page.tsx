"use client";

import { useState } from "react";
import { Rocket, Loader2, CheckCircle2 } from "lucide-react";
import ModelSelector from "@/components/workflow/ModelSelector";
import type { ModelConfig, WorkflowInput } from "@/lib/workflow/types";

/**
 * WorkflowIntakePage
 * Demo page showing ModelSelector integration with workflow start form
 * 
 * In production, this would be the entry point for starting new workflows
 */
export default function WorkflowIntakePage() {
  const [formData, setFormData] = useState<Partial<WorkflowInput>>({
    title: "",
    description: "",
    modelOverride: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log("Workflow submission:", {
      ...formData,
      modelOverride: formData.modelOverride || "(default)",
    });

    setSubmitting(false);
    setSubmitted(true);

    // Reset after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        title: "",
        description: "",
        modelOverride: undefined,
      });
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Start New Workflow</h1>
        <p className="text-sm text-gray-400">
          Configure your agentic workflow. Select a model to use for dev agents,
          or leave it as default to use Claude Sonnet 4.5.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
            Workflow Title
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Add user authentication to iOS app"
            required
            disabled={submitting}
            className="w-full px-4 py-3 bg-surface-2 border border-surface-4 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what you want the agents to build..."
            required
            rows={4}
            disabled={submitting}
            className="w-full px-4 py-3 bg-surface-2 border border-surface-4 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none disabled:opacity-50"
          />
        </div>

        {/* Model Selector */}
        <ModelSelector
          value={formData.modelOverride}
          onChange={(model) => setFormData(prev => ({ ...prev, modelOverride: model }))}
          disabled={submitting}
        />

        {/* Info Box */}
        <div className="bg-surface-3/50 border border-surface-4 rounded-lg p-4">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Note:</strong> The selected model will be used by
            design and development agents. The requirements agent always uses the default model
            to ensure consistent quality.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-4">
          {submitted && (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Workflow started!</span>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !formData.title || !formData.description}
            className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting workflow...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Start Workflow
              </>
            )}
          </button>
        </div>
      </form>

      {/* Debug Output */}
      {formData.modelOverride && (
        <div className="mt-6 card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Selected Model (Debug)</h3>
          <pre className="text-xs text-gray-400 bg-surface-1 border border-surface-4 rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(formData.modelOverride, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
