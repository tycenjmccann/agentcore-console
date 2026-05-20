"use client";

import { useEffect, useState } from "react";
import { GitPullRequest, ExternalLink } from "lucide-react";

interface PRLinkData {
  agentId: string;
  prUrl: string;
}

interface PRLinksProps {
  workflowId: string;
}

export default function PRLinks({ workflowId }: PRLinksProps) {
  const [prLinks, setPrLinks] = useState<PRLinkData[]>([]);

  useEffect(() => {
    // Fetch workflow state to extract PR URLs from agent tasks
    const fetchPRLinks = async () => {
      try {
        const res = await fetch(`/api/workflow/${workflowId}/state`);
        if (!res.ok) return;
        const state = await res.json();

        const links: PRLinkData[] = [];
        if (state.agentTasks) {
          for (const [agentId, task] of Object.entries(state.agentTasks)) {
            const agentTask = task as { output?: string; branch?: string; commitSha?: string };
            // Check if output contains a PR URL
            if (agentTask.output) {
              const prMatch = agentTask.output.match(
                /https:\/\/github\.com\/[^\s"')]+\/pull\/\d+/
              );
              if (prMatch) {
                links.push({ agentId, prUrl: prMatch[0] });
              }
            }
          }
        }
        setPrLinks(links);
      } catch {
        // Silent - PR links are optional enhancement
      }
    };

    fetchPRLinks();
    // Poll every 10s since PRs are created infrequently
    const interval = setInterval(fetchPRLinks, 10000);
    return () => clearInterval(interval);
  }, [workflowId]);

  if (prLinks.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Pull Requests
      </h3>
      <div className="space-y-2">
        {prLinks.map((link) => (
          <a
            key={`${link.agentId}-${link.prUrl}`}
            href={link.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/60 border border-zinc-700 hover:border-green-500/40 hover:bg-zinc-800 transition-all group"
          >
            {/* GitHub icon */}
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-600 flex items-center justify-center flex-shrink-0 group-hover:border-green-500/50 transition-colors">
              <GitPullRequest className="w-4 h-4 text-green-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                Pull Request
              </p>
              <p className="text-xs text-zinc-500 truncate">
                by {formatAgentName(link.agentId)}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs text-zinc-500 group-hover:text-green-400 transition-colors">
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function formatAgentName(agentId: string): string {
  return agentId
    .replace(/^team-/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
