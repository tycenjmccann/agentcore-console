import React from 'react';
import { ModelConfig } from '@/lib/types';
import { Info } from 'lucide-react';

interface ModelDisplayProps {
  modelConfig?: ModelConfig;
}

/**
 * ModelDisplay Component
 * 
 * Displays the selected model and provider in the WorkflowBoard header.
 * Shows "Provider - Model Name" format with a tooltip containing the full model ID.
 */
export const ModelDisplay: React.FC<ModelDisplayProps> = ({ modelConfig }) => {
  // Default model configuration
  const defaultConfig: ModelConfig = {
    provider: 'bedrock',
    modelId: 'us.anthropic.claude-sonnet-4-5-v2:0',
    displayName: 'Claude Sonnet 4.5',
    bedrockModelConfig: {
      modelId: 'us.anthropic.claude-sonnet-4-5-v2:0'
    }
  };

  // Use provided config or default
  const config = modelConfig || defaultConfig;

  // Format provider name for display
  const formatProvider = (provider: string): string => {
    switch (provider) {
      case 'bedrock':
        return 'Bedrock';
      case 'openai':
        return 'OpenAI';
      case 'gemini':
        return 'Google Gemini';
      default:
        return 'Unknown';
    }
  };

  // Get display text
  const providerDisplay = formatProvider(config.provider);
  const displayText = config.displayName || 'Unknown Model';
  const fullDisplay = `${providerDisplay} - ${displayText}`;

  // Get full model ID for tooltip
  const fullModelId = config.modelId || 'N/A';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
      {/* Model display text */}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {fullDisplay}
      </span>

      {/* Info icon with tooltip */}
      <div className="group relative">
        <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help" />
        
        {/* Tooltip */}
        <div className="absolute hidden group-hover:block z-50 w-max max-w-xs px-3 py-2 text-xs text-white bg-slate-900 dark:bg-slate-700 rounded-md shadow-lg right-0 top-6">
          <div className="font-semibold mb-1">Model ID:</div>
          <div className="font-mono break-all">{fullModelId}</div>
          {/* Tooltip arrow */}
          <div className="absolute w-2 h-2 bg-slate-900 dark:bg-slate-700 transform rotate-45 -top-1 right-4" />
        </div>
      </div>
    </div>
  );
};
