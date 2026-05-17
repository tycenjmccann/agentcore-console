"use client";

import React, { useState } from 'react';
import { ModelSelector } from '@/components/ModelSelector';
import { useModelAvailability } from '@/hooks/useModelAvailability';
import { IntakeFormData, ModelConfig } from '@/types';

interface IntakeFormProps {
  onSubmit: (data: IntakeFormData) => void;
}

export function IntakeForm({ onSubmit }: IntakeFormProps) {
  const [formData, setFormData] = useState<IntakeFormData>({
    projectName: '',
    description: '',
    requirements: '',
    modelConfig: undefined,
  });

  const { availability, loading, error } = useModelAvailability();

  const handleModelChange = (config: ModelConfig) => {
    setFormData(prev => ({ ...prev, modelConfig: config }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Set default model if not selected
    const dataToSubmit = {
      ...formData,
      modelConfig: formData.modelConfig || {
        provider: 'bedrock' as const,
        modelId: 'us.anthropic.claude-sonnet-4-5-v1:0',
        displayName: 'Claude Sonnet 4.5',
        bedrockModelConfig: {
          modelId: 'us.anthropic.claude-sonnet-4-5-v1:0',
        },
      },
    };
    
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
          Project Name
        </label>
        <input
          id="projectName"
          type="text"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.projectName}
          onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          required
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="requirements" className="block text-sm font-medium text-gray-700">
          Requirements
        </label>
        <textarea
          id="requirements"
          required
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.requirements}
          onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="model" className="block text-sm font-medium text-gray-700">
          AI Model
        </label>
        {loading ? (
          <div className="text-sm text-gray-500">Loading available models...</div>
        ) : error ? (
          <div className="text-sm text-red-600">Error loading models: {error.message}</div>
        ) : (
          <ModelSelector
            value={formData.modelConfig}
            onChange={handleModelChange}
            openAiAvailable={availability.openAiAvailable}
            geminiAvailable={availability.geminiAvailable}
          />
        )}
        <p className="text-sm text-gray-500 mt-1">
          Select the AI model to use for this workflow. Default: Claude Sonnet 4.5
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create Workflow
        </button>
      </div>
    </form>
  );
}
