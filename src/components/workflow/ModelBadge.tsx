import type { ModelConfig } from "@/lib/workflow/types";
import { getModelDisplayName, isDefaultModel } from "@/lib/workflow/model-utils";

interface ModelBadgeProps {
  modelConfig?: ModelConfig;
}

/**
 * Displays a subtle badge showing the selected model for development agents.
 * Only renders if a non-default model is selected.
 */
export default function ModelBadge({ modelConfig }: ModelBadgeProps) {
  // Don't show anything if no model config or using default
  if (!modelConfig || isDefaultModel(modelConfig)) {
    return null;
  }

  const displayName = getModelDisplayName(modelConfig);

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      <span>
        Using <span className="font-medium text-blue-400">{displayName}</span> for
        development agents
      </span>
    </div>
  );
}
