"use client";

import ModelDisplay from "@/components/workflow/ModelDisplay";
import { ModelConfig } from "@/types/workflow";

// Example model configurations for testing
const exampleModels: ModelConfig[] = [
  {
    provider: "bedrock",
    modelId: "anthropic.claude-sonnet-4-5-v2:0",
    displayName: "Claude Sonnet 4.5",
    bedrockModelConfig: {
      modelId: "anthropic.claude-sonnet-4-5-v2:0",
    },
  },
  {
    provider: "bedrock",
    modelId: "anthropic.claude-opus-4-5-v2:0",
    displayName: "Claude Opus 4.5",
    bedrockModelConfig: {
      modelId: "anthropic.claude-opus-4-5-v2:0",
    },
  },
  {
    provider: "bedrock",
    modelId: "amazon.nova-pro-v1:0",
    displayName: "Amazon Nova Pro",
    bedrockModelConfig: {
      modelId: "amazon.nova-pro-v1:0",
    },
  },
  {
    provider: "openai",
    modelId: "gpt-5.5",
    displayName: "GPT-5.5",
    openAiModelConfig: {
      modelId: "gpt-5.5",
      apiKeyArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:openai-key",
    },
  },
  {
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    geminiModelConfig: {
      modelId: "gemini-2.5-pro",
      apiKeyArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:gemini-key",
    },
  },
];

export default function ModelDisplayExamplesPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Model Display Examples</h2>
        <p className="text-sm text-gray-400">
          Examples of model display component with different providers and configurations.
        </p>
      </div>

      {/* Default/undefined model */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Default Model (undefined config)</h3>
        <p className="text-xs text-gray-500 mb-3">
          When no modelConfig is provided, displays the default Bedrock Claude Sonnet 4.5
        </p>
        <ModelDisplay />
      </div>

      {/* All provider examples */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">All Supported Models</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exampleModels.map((model) => (
            <div key={`${model.provider}-${model.modelId}`} className="p-4 bg-surface-3/30 rounded-lg border border-surface-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                {model.provider}
              </p>
              <ModelDisplay modelConfig={model} />
            </div>
          ))}
        </div>
      </div>

      {/* Responsive layout test */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Responsive Header Layout</h3>
        <p className="text-xs text-gray-500 mb-4">
          Simulates how the model display appears in the WorkflowBoard header on different screen sizes
        </p>
        
        <div className="space-y-4">
          {/* Desktop layout */}
          <div className="border border-surface-4 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-3">Desktop (≥1024px)</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Feature Development Workflow</h1>
                <p className="text-sm text-gray-400 mt-1">Building user profile feature</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Model</p>
                </div>
                <ModelDisplay modelConfig={exampleModels[0]} />
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="border border-surface-4 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-3">Mobile (<640px)</p>
            <div className="space-y-3">
              <div>
                <h1 className="text-xl font-bold text-white">Feature Development Workflow</h1>
                <p className="text-sm text-gray-400 mt-1">Building user profile feature</p>
              </div>
              <div>
                <ModelDisplay modelConfig={exampleModels[0]} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edge cases */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Edge Cases</h3>
        <div className="space-y-4">
          {/* Unknown model ID */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Unknown Model ID</p>
            <ModelDisplay 
              modelConfig={{
                provider: "bedrock",
                modelId: "unknown.model.id",
                displayName: "Unknown Model",
              }} 
            />
          </div>

          {/* Missing displayName */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Missing Display Name (uses modelId mapping)</p>
            <ModelDisplay 
              modelConfig={{
                provider: "bedrock",
                modelId: "anthropic.claude-sonnet-4-5-v2:0",
                displayName: "",
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
