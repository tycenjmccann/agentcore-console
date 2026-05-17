"use client";

import { useState, useEffect } from "react";
import { Activity, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { WorkflowState } from "@/types/workflow";
import ModelDisplay from "@/components/workflow/ModelDisplay";

interface WorkflowBoardProps {
  workflowId?: string;
}

export default function WorkflowBoard({ workflowId }: WorkflowBoardProps) {
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch workflow data
    // In a real implementation, this would call the API
    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        // Mock data for demonstration
        // Replace with actual API call:
        // const response = await fetch(`/api/workflows/${workflowId}`);
        // const data = await response.json();
        
        // Simulated workflow data
        const mockWorkflow: WorkflowState = {
          id: workflowId || "wf_123456",
          name: "Feature Development Workflow",
          description: "Automated feature implementation workflow",
          status: "running",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Model config will be read from actual workflow state
          // Falls back to default if not set
        };
        
        setWorkflow(mockWorkflow);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        setLoading(false);
      }
    };

    if (workflowId) {
      fetchWorkflow();
    } else {
      setLoading(false);
    }
  }, [workflowId]);

  const getStatusIcon = () => {
    if (!workflow) return null;
    
    switch (workflow.status) {
      case "running":
        return <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "draft":
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    if (!workflow) return "bg-gray-400/10 text-gray-400 border-gray-400/30";
    
    switch (workflow.status) {
      case "running":
        return "bg-brand-400/10 text-brand-400 border-brand-400/30";
      case "completed":
        return "bg-green-400/10 text-green-400 border-green-400/30";
      case "failed":
        return "bg-red-400/10 text-red-400 border-red-400/30";
      case "draft":
        return "bg-gray-400/10 text-gray-400 border-gray-400/30";
      default:
        return "bg-gray-400/10 text-gray-400 border-gray-400/30";
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          <span className="ml-3 text-sm text-gray-400">Loading workflow...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 p-4 bg-red-400/10 border border-red-400/30 rounded-lg">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">Error loading workflow</p>
            <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No workflow selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left side: Workflow info */}
          <div className="flex items-start gap-4">
            <div className="mt-1">
              {getStatusIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white truncate">
                  {workflow.name}
                </h1>
                <span className={`px-2 py-1 rounded-full border text-xs font-medium ${
                  getStatusColor()
                }`}>
                  {workflow.status.toUpperCase()}
                </span>
              </div>
              {workflow.description && (
                <p className="text-sm text-gray-400 mt-1">{workflow.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>ID: {workflow.id}</span>
                <span>•</span>
                <span>Created {new Date(workflow.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Right side: Model display */}
          <div className="flex items-center gap-3 lg:flex-shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Model</p>
            </div>
            <ModelDisplay 
              modelConfig={workflow.modelConfig}
              showTooltip={true}
              className=""
            />
          </div>
        </div>
      </div>

      {/* Workflow Content Area */}
      <div className="card">
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Workflow content area</p>
          <p className="text-xs text-gray-600 mt-1">Additional workflow details and progress will be displayed here</p>
        </div>
      </div>
    </div>
  );
}
