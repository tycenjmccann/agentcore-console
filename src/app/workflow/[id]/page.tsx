"use client";

import { useParams } from "next/navigation";
import { WorkflowBoard } from "@/components/workflow/pipeline";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function WorkflowPage() {
  const params = useParams();
  const workflowId = params.id as string;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Workflow Pipeline</h1>
          <p className="text-xs text-gray-500 font-mono">{workflowId}</p>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <WorkflowBoard workflowId={workflowId} />
    </div>
  );
}
