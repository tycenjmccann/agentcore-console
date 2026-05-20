"use client";

import { useEffect, useState, useCallback } from "react";
import { Folder, FileText, FileCode, FileJson, Loader2, AlertCircle, FolderOpen } from "lucide-react";

interface ArtifactItem {
  key: string;
  size: number;
  lastModified: string;
  agent: string;
}

interface ArtifactListProps {
  workflowId: string;
  onSelectFile: (filePath: string) => void;
  selectedFile: string | null;
}

interface GroupedArtifacts {
  [agent: string]: ArtifactItem[];
}

export default function ArtifactList({ workflowId, onSelectFile, selectedFile }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const fetchArtifacts = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/workflow/${workflowId}/artifacts`);
      if (!res.ok) {
        throw new Error(`Failed to fetch artifacts: ${res.status}`);
      }
      const data = await res.json();
      setArtifacts(data);
      // Auto-expand all agents on first load
      const agents = new Set(data.map((a: ArtifactItem) => a.agent));
      setExpandedAgents(agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const toggleAgent = (agent: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  };

  // Group artifacts by agent
  const grouped: GroupedArtifacts = artifacts.reduce((acc, item) => {
    if (!acc[item.agent]) acc[item.agent] = [];
    acc[item.agent].push(item);
    return acc;
  }, {} as GroupedArtifacts);

  // Get relative path for display (strip the workflow prefix)
  const getDisplayPath = (item: ArtifactItem): string => {
    const parts = item.key.split("/");
    // Key format: workflows/{id}/agents/{agent}/... or workflows/{id}/shared/...
    const agentIndex = parts.indexOf("agents");
    if (agentIndex !== -1 && agentIndex + 2 < parts.length) {
      return parts.slice(agentIndex + 2).join("/");
    }
    const sharedIndex = parts.indexOf("shared");
    if (sharedIndex !== -1 && sharedIndex + 1 < parts.length) {
      return parts.slice(sharedIndex + 1).join("/");
    }
    return parts[parts.length - 1];
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".json")) return <FileJson className="w-4 h-4 text-yellow-400" />;
    if (filename.endsWith(".ts") || filename.endsWith(".tsx") || filename.endsWith(".js") || filename.endsWith(".jsx"))
      return <FileCode className="w-4 h-4 text-blue-400" />;
    if (filename.endsWith(".css") || filename.endsWith(".scss"))
      return <FileCode className="w-4 h-4 text-purple-400" />;
    if (filename.endsWith(".md")) return <FileText className="w-4 h-4 text-green-400" />;
    return <FileText className="w-4 h-4 text-zinc-400" />;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-2" />
        <span className="text-sm text-zinc-400">Loading artifacts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm text-red-400 mb-2">Failed to load artifacts</p>
        <p className="text-xs text-zinc-500 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchArtifacts(); }}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md border border-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Folder className="w-8 h-8 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-400">No artifacts yet</p>
        <p className="text-xs text-zinc-500 mt-1">Artifacts will appear here as agents produce output</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Artifacts ({artifacts.length} files)
      </h3>

      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([agent, files]) => {
          const isExpanded = expandedAgents.has(agent);
          return (
            <div key={agent} className="mb-1">
              {/* Agent folder header */}
              <button
                onClick={() => toggleAgent(agent)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors group"
              >
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-sm font-medium text-zinc-200 group-hover:text-white">
                  {agent}/
                </span>
                <span className="text-xs text-zinc-500 ml-auto">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </span>
              </button>

              {/* File items */}
              {isExpanded && (
                <div className="ml-4 border-l border-zinc-800 pl-2">
                  {files
                    .sort((a, b) => getDisplayPath(a).localeCompare(getDisplayPath(b)))
                    .map((file) => {
                      const displayPath = getDisplayPath(file);
                      const isSelected = selectedFile === file.key;
                      return (
                        <button
                          key={file.key}
                          onClick={() => onSelectFile(file.key)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors ${
                            isSelected
                              ? "bg-blue-600/15 border border-blue-500/30"
                              : "hover:bg-zinc-800/40 border border-transparent"
                          }`}
                        >
                          {getFileIcon(displayPath)}
                          <span className={`text-xs font-mono truncate ${
                            isSelected ? "text-blue-300" : "text-zinc-300"
                          }`}>
                            {displayPath}
                          </span>
                          <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">
                            {formatSize(file.size)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
