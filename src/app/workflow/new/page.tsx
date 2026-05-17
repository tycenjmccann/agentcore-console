"use client";

import { useState } from "react";
import { ArrowLeft, Rocket } from "lucide-react";
import Link from "next/link";
import IntakeForm, { IntakeFormData } from "@/components/IntakeForm";

export default function NewWorkflowPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: IntakeFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Submit to workflow start API
      const response = await fetch("/api/workflow/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          modelConfig: data.modelConfig,
          // Additional fields would be added here:
          // repoConfig, sources, etc.
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start workflow");
      }

      const result = await response.json();

      // Redirect to workflow status page
      window.location.href = `/workflow/${result.workflowId}`;
    } catch (err) {
      console.error("Error starting workflow:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Start New Workflow</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure and launch an agentic development workflow
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="card">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <IntakeForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-surface-1 border border-surface-4 rounded-xl">
        <h3 className="text-sm font-medium text-gray-300 mb-2">How it works</h3>
        <ul className="text-xs text-gray-500 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
            <span>Describe your feature requirements in detail</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
            <span>Choose the AI model for your dev agents</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
            <span>Agents analyze requirements, design, and implement code</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">4</span>
            <span>Review the generated pull request</span>
          </li>
        </ul>
      </div>
    </div>
  );
}