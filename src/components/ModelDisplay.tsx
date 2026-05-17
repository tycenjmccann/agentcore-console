// components/ModelDisplay.tsx
import React, { useState } from 'react';
import { ModelConfig } from '../types';

interface ModelDisplayProps {
  modelConfig?: ModelConfig;
}

// Default model when no config is provided
const DEFAULT_MODEL: ModelConfig = {
  provider: 'bedrock',
  modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0',
  displayName: 'Claude Sonnet 4.5',
  bedrockModelConfig: {
    modelId: 'us.anthropic.claude-sonnet-4-5-20250131-v1:0'
  }
};

// Helper function to format provider name
const formatProvider = (provider: string): string => {
  switch (provider) {
    case 'bedrock':
      return 'Bedrock';
    case 'openai':
      return 'OpenAI';
    case 'gemini':
      return 'Gemini';
    default:
      return 'Unknown';
  }
};

// Helper function to get display text
const getDisplayText = (config: ModelConfig): string => {
  const provider = formatProvider(config.provider);
  return `${provider} - ${config.displayName}`;
};

// Helper function to get short display text for mobile
const getShortDisplayText = (config: ModelConfig): string => {
  // On mobile, just show the model name
  return config.displayName;
};

export const ModelDisplay: React.FC<ModelDisplayProps> = ({ modelConfig }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = modelConfig || DEFAULT_MODEL;
  const displayText = getDisplayText(config);
  const shortDisplayText = getShortDisplayText(config);
  
  return (
    <div className="relative">
      {/* Main badge */}
      <button
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {/* Provider icon/badge */}
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
          {config.provider === 'bedrock' && 'B'}
          {config.provider === 'openai' && 'O'}
          {config.provider === 'gemini' && 'G'}
        </span>
        
        {/* Model display text - responsive */}
        <span className="hidden sm:inline whitespace-nowrap">{displayText}</span>
        <span className="inline sm:hidden whitespace-nowrap">{shortDisplayText}</span>
      </button>
      
      {/* Tooltip with full model ID */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Provider:</span> {formatProvider(config.provider)}
            </div>
            <div>
              <span className="font-semibold">Model:</span> {config.displayName}
            </div>
            <div className="pt-1 border-t border-gray-700">
              <span className="font-semibold">Model ID:</span>
              <div className="mt-1 break-all text-gray-300">{config.modelId}</div>
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};
