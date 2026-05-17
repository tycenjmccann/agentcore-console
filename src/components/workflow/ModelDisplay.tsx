"use client";

import { Info } from "lucide-react";
import { ModelConfig, formatModelDisplay, getProviderDisplayName } from "@/types/workflow";

interface ModelDisplayProps {
  modelConfig?: ModelConfig;
  showTooltip?: boolean;
  className?: string;
}

export default function ModelDisplay({ 
  modelConfig, 
  showTooltip = true,
  className = "" 
}: ModelDisplayProps) {
  const displayText = formatModelDisplay(modelConfig);
  const modelId = modelConfig?.modelId || "anthropic.claude-sonnet-4-5-v2:0";
  const provider = modelConfig?.provider || "bedrock";
  
  // Get provider color
  const getProviderColor = () => {
    switch (provider) {
      case "bedrock":
        return "bg-brand-600/20 text-brand-400 border-brand-400/30";
      case "openai":
        return "bg-green-600/20 text-green-400 border-green-400/30";
      case "gemini":
        return "bg-blue-600/20 text-blue-400 border-blue-400/30";
      default:
        return "bg-gray-600/20 text-gray-400 border-gray-400/30";
    }
  };
  
  return (
    <div className={`group relative ${className}`}>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
        getProviderColor()
      }`}>
        <span className="font-semibold">{displayText}</span>
        {showTooltip && (
          <Info className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-surface-2 border border-surface-4 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Provider</p>
              <p className="text-sm text-white font-medium">{getProviderDisplayName(provider)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Model ID</p>
              <p className="text-xs text-gray-300 font-mono break-all">{modelId}</p>
            </div>
            {modelConfig?.displayName && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Display Name</p>
                <p className="text-sm text-white">{modelConfig.displayName}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
