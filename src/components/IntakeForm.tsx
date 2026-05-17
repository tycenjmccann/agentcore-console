"use client";

import { useState } from "react";
import { Send, Upload, Link as LinkIcon, AlertCircle } from "lucide-react";
import type { WorkflowInput, RepoConfig, IntakeSource, ModelConfig } from "@/lib/workflow/types";
import ModelSelector from "@/components/ModelSelector";

interface IntakeFormProps {
  onSubmit: (input: WorkflowInput) => void;
  loading?: boolean;
}

export default function IntakeForm({ onSubmit, loading = false }: IntakeFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("https://github.com/tycenjmccann/agentcore-console");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [sourceUrl, setSourceUrl] = useState("");
  const [modelOverride, setModelOverride] = useState<ModelConfig | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!repoUrl.trim()) {
      newErrors.repoUrl = "Repository URL is required";
    } else if (!repoUrl.startsWith("https://github.com/")) {
      newErrors.repoUrl = "Must be a valid GitHub repository URL";
    }

    if (!defaultBranch.trim()) {
      newErrors.defaultBranch = "Default branch is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const repoConfig: RepoConfig = {
      layout: "monorepo",
      repos: [
        {
          url: repoUrl,
          defaultBranch,
          platform: "shared",
        },
      ],
    };

    const sources: IntakeSource[] = [];
    if (sourceUrl.trim()) {
      sources.push({
        type: "url",
        value: sourceUrl,
        label: "PRD or Design Doc",
      });
    }

    const input: WorkflowInput = {
      title: title.trim(),
      description: description.trim(),
      repoConfig,
      sources,
      modelOverride,
    };

    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-gray-300">
          Workflow Title <span className="text-red-400">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-surface-2 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
          placeholder="e.g., Add user authentication feature"
          aria-required="true"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
        {errors.title && (
          <p id="title-error" className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.title}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-gray-300">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          rows={4}
          className="w-full px-4 py-2.5 bg-surface-2 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 resize-none"
          placeholder="Describe what you want the team to build..."
          aria-required="true"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
        />
        {errors.description && (
          <p id="description-error" className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.description}
          </p>
        )}
      </div>

      {/* Repository Configuration */}
      <div className="space-y-4 p-4 bg-surface-2 rounded-lg border border-surface-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          Repository Configuration
        </h3>

        <div className="space-y-2">
          <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-300">
            Repository URL <span className="text-red-400">*</span>
          </label>
          <input
            id="repoUrl"
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-surface-3 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
            placeholder="https://github.com/username/repo"
            aria-required="true"
            aria-invalid={!!errors.repoUrl}
            aria-describedby={errors.repoUrl ? "repoUrl-error" : undefined}
          />
          {errors.repoUrl && (
            <p id="repoUrl-error" className="text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.repoUrl}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="defaultBranch" className="block text-sm font-medium text-gray-300">
            Default Branch <span className="text-red-400">*</span>
          </label>
          <input
            id="defaultBranch"
            type="text"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-surface-3 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
            placeholder="main"
            aria-required="true"
            aria-invalid={!!errors.defaultBranch}
            aria-describedby={errors.defaultBranch ? "defaultBranch-error" : undefined}
          />
          {errors.defaultBranch && (
            <p id="defaultBranch-error" className="text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.defaultBranch}
            </p>
          )}
        </div>
      </div>

      {/* Source Document (Optional) */}
      <div className="space-y-2">
        <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-300">
          Source Document URL <span className="text-gray-500">(optional)</span>
        </label>
        <input
          id="sourceUrl"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-surface-2 border border-surface-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
          placeholder="https://docs.google.com/document/..."
        />
        <p className="text-xs text-gray-500">
          Link to PRD, design document, or requirements
        </p>
      </div>

      {/* Model Selector */}
      <ModelSelector
        value={modelOverride}
        onChange={setModelOverride}
        disabled={loading}
      />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-1"
        aria-label="Start workflow"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Starting Workflow...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Start Workflow
          </>
        )}
      </button>
    </form>
  );
}
