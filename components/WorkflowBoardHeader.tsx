"use client";

import React from 'react';
import { WorkflowState } from '@/types';

interface WorkflowBoardHeaderProps {
  workflow: WorkflowState;
}

export function WorkflowBoardHeader({ workflow }: WorkflowBoardHeaderProps) {
  const modelDisplay = workflow.modelConfig
    ? `${getProviderDisplayName(workflow.modelConfig.provider)} - ${workflow.modelConfig.displayName}`
    : 'AWS Bedrock - Claude Sonnet 4.5'; // Default

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Workflow: {workflow.workflowId}
          </h1>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center">
              <span className="font-medium">Status:</span>
              <span className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                workflow.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : workflow.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : workflow.status === 'in-progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {workflow.status}
              </span>
            </div>
            <div className="flex items-center">
              <span className="font-medium">Model:</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                {modelDisplay}
              </span>
            </div>
            <div>
              <span className="font-medium">Created:</span>
              <span className="ml-2">
                {new Date(workflow.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getProviderDisplayName(provider: 'bedrock' | 'openai' | 'gemini'): string {
  switch (provider) {
    case 'bedrock':
      return 'AWS Bedrock';
    case 'openai':
      return 'OpenAI';
    case 'gemini':
      return 'Google Gemini';
    default:
      return provider;
  }
}
