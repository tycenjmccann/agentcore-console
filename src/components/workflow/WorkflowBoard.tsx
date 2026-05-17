"use client";

import * as React from "react";
import { WorkflowState } from "@/types/model";
import { cn } from "@/lib/utils";
import { Brain, Zap } from "lucide-react";

interface WorkflowBoardProps {
  workflow: WorkflowState;
  className?: string;
}

export function WorkflowBoard({ workflow, className }: WorkflowBoardProps) {
  const modelDisplay = workflow.modelConfig
    ? `${getProviderDisplayName(workflow.modelConfig.provider)} - ${workflow.modelConfig.displayName}`
    : "Claude Sonnet 4.5 (Default)";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Workflow Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Workflow Board</h1>
              <p className="text-sm text-gray-500 mt-1">ID: {workflow.workflowId || "N/A"}</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-green-400/10 text-green-400 border border-green-400/30 rounded-full text-xs font-medium">
            {workflow.status || "Active"}
          </div>
        </div>

        {/* Model Configuration Display */}
        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-brand-400" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Model Configuration</p>
              <p className="text-sm text-gray-200 font-medium mt-1">{modelDisplay}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Content (placeholder) */}
      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Agent Tasks
        </h3>
        <p className="text-sm text-gray-400">Workflow tasks will be displayed here...</p>
      </div>
    </div>
  );
}

function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    bedrock: "Amazon Bedrock",
    openai: "OpenAI",
    gemini: "Google Gemini",
  };
  return names[provider] || provider;
}
