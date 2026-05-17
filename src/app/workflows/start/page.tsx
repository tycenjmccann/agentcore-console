"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IntakeForm from "@/components/IntakeForm";
import type { WorkflowInput } from "@/lib/workflow/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function StartWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (input: WorkflowInput) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start workflow");
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to workflow detail page after a brief delay
      setTimeout(() => {
        router.push(`/workflows/${data.workflowId}`);
      }, 1500);
    } catch (err) {
      console.error("Error starting workflow:", err);
      setError(err instanceof Error ? err.message : "Failed to start workflow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Start New Workflow
        </h1>
        <p className="text-gray-400">
          Describe what you want to build, and the AI team will handle the rest.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-400 mb-1">
              Failed to start workflow
            </h3>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-green-400 mb-1">
              Workflow started successfully!
            </h3>
            <p className="text-sm text-gray-300">Redirecting to workflow details...</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <IntakeForm onSubmit={handleSubmit} loading={loading} />
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">
          How it works
        </h3>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>Requirements agent analyzes your description and creates tickets</li>
          <li>Design agents create architecture and implementation plans</li>
          <li>Development agents write code and create pull requests</li>
          <li>Review agents check code quality and submit for human review</li>
        </ol>
      </div>
    </div>
  );
}
