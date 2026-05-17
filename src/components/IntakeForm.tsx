"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import ModelSelector from "@/components/ModelSelector";
import { ModelConfig } from "@/lib/types/model-config";
import { cn } from "@/lib/utils";

interface IntakeFormProps {
  onSubmit: (data: WorkflowIntakeData) => void;
  className?: string;
}

export interface WorkflowIntakeData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  modelConfig: ModelConfig;
}

export default function IntakeForm({ onSubmit, className }: IntakeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [modelConfig, setModelConfig] = useState<ModelConfig | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim() || !modelConfig) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        priority,
        modelConfig,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = title.trim() && description.trim() && modelConfig;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand-400" />
        <h2 className="text-lg font-semibold text-white">Workflow Intake</h2>
      </div>

      {/* Workflow Title */}
      <div>
        <label
          htmlFor="workflow-title"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Workflow Title
        </label>
        <input
          id="workflow-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., User Authentication Feature"
          className="w-full bg-surface-2 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Workflow Description */}
      <div>
        <label
          htmlFor="workflow-description"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Description
        </label>
        <textarea
          id="workflow-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the workflow objectives, requirements, and expected outcomes..."
          rows={6}
          className="w-full bg-surface-2 border border-surface-4 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Priority Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Priority
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'low', label: 'Low', color: 'gray' },
            { value: 'medium', label: 'Medium', color: 'blue' },
            { value: 'high', label: 'High', color: 'orange' },
            { value: 'critical', label: 'Critical', color: 'red' },
          ].map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value as typeof priority)}
              disabled={isSubmitting}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                priority === p.value
                  ? `bg-${p.color}-600/20 text-${p.color}-400 border-${p.color}-600/40`
                  : "bg-surface-2 border-surface-4 text-gray-400 hover:bg-surface-3",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <ModelSelector
        value={modelConfig}
        onChange={setModelConfig}
      />

      {/* Model Info Display */}
      {modelConfig && (
        <div className="bg-surface-2 border border-surface-4 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Selected Model Configuration</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{modelConfig.displayName}</p>
              <p className="text-xs text-gray-400 capitalize">{modelConfig.provider}</p>
            </div>
            <div className="text-xs text-gray-500 font-mono bg-surface-1 px-2 py-1 rounded">
              {modelConfig.modelId}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center gap-3 pt-4 border-t border-surface-4">
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="flex-1 btn-primary py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting Workflow...
            </span>
          ) : (
            "Start Workflow"
          )}
        </button>
      </div>
    </form>
  );
}
