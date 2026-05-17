// components/WorkflowBoard.tsx
import React from 'react';
import { WorkflowState } from '../types';
import { ModelDisplay } from './ModelDisplay';

interface WorkflowBoardProps {
  workflow: WorkflowState;
}

export const WorkflowBoard: React.FC<WorkflowBoardProps> = ({ workflow }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Workflow name and status */}
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Workflow Board
              </h1>
              <span className="text-sm text-gray-500">
                {workflow.workflowId}
              </span>
              <span 
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  workflow.status === 'completed' 
                    ? 'bg-green-100 text-green-800'
                    : workflow.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800'
                    : workflow.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {workflow.status}
              </span>
            </div>
            
            {/* Right side - Model display */}
            <div className="flex items-center gap-4">
              <ModelDisplay modelConfig={workflow.modelConfig} />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow content goes here */}
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Workflow content area</p>
        </div>
      </main>
    </div>
  );
};
