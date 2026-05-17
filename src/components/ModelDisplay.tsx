/**
 * ModelDisplay Component
 * 
 * Displays the selected model and provider in the WorkflowBoard header.
 * Shows "Provider - Model Name" with a tooltip containing the full model ID.
 */

import React from 'react';
import { ModelConfig, DEFAULT_MODEL_CONFIG } from '@/types/workflow';
import { Cpu } from 'lucide-react';

interface ModelDisplayProps {
  modelConfig?: ModelConfig;
  className?: string;
}

/**
 * Maps provider to display name
 */
const getProviderDisplayName = (provider: string): string => {
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

/**
 * ModelDisplay Component
 * 
 * Displays current model configuration with tooltip for debugging.
 */
export function ModelDisplay({ modelConfig, className = '' }: ModelDisplayProps) {
  // Use default model if no config provided
  const config = modelConfig || DEFAULT_MODEL_CONFIG;
  
  // Handle invalid/unknown models
  if (!config.provider || !config.displayName) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-sm ${className}`}
        title="Invalid model configuration"
      >
        <Cpu className="w-4 h-4" />
        <span className="font-medium">Unknown Model</span>
      </div>
    );
  }

  const providerName = getProviderDisplayName(config.provider);
  const displayText = `${providerName} - ${config.displayName}`;
  const fullModelId = config.modelId;

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 text-blue-900 text-sm border border-blue-200 hover:bg-blue-100 transition-colors cursor-help ${className}`}
      title={`Model ID: ${fullModelId}`}
    >
      <Cpu className="w-4 h-4" />
      <span className="font-medium">{displayText}</span>
    </div>
  );
}

export default ModelDisplay;
