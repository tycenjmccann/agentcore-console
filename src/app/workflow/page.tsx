"use client";

import { useState } from "react";
import IntakeForm from "@/components/workflow/IntakeForm";
import WorkflowBoard from "@/components/workflow/WorkflowBoard";
import type { WorkflowInput } from "@/lib/workflow/types";

export default function WorkflowPage() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (input: WorkflowInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/workflow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { workflowId: id } = await res.json();
      setWorkflowId(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!workflowId ? (
        <>
          {error && (
            <div className="max-w-2xl mx-auto p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}
          <IntakeForm onSubmit={handleSubmit} isLoading={isLoading} />
        </>
      ) : (
        <WorkflowBoard workflowId={workflowId} />
      )}
    </div>
  );
}
