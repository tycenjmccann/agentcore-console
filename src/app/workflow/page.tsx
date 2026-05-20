"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Play } from "lucide-react";
import WorkflowBoard from "@/components/workflow/WorkflowBoard";
import IntakeForm from "@/components/workflow/IntakeForm";
import HistorySidebar from "@/components/workflow/HistorySidebar";
import type { WorkflowEntry } from "@/components/workflow/HistorySidebar";
import type { WorkflowState, WorkflowInput } from "@/lib/workflow/types";

interface WorkflowSummary {
  id: string;
  phase: string;
  epicId: string;
  input: { title: string; description: string };
  startedAt: string;
  completedAt?: string;
}

export default function WorkflowPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load workflow list
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow/list");
      if (!res.ok) return;
      const data = await res.json();
      const list: WorkflowSummary[] = (data.workflows || []).map((w: WorkflowState) => ({
        id: w.id,
        phase: w.phase,
        epicId: w.epicId,
        input: { title: w.input.title, description: w.input.description },
        startedAt: w.startedAt,
        completedAt: w.completedAt,
      }));
      // Sort: active first, then by date descending
      list.sort((a, b) => {
        const aActive = a.phase !== "complete" && a.phase !== "error";
        const bActive = b.phase !== "complete" && b.phase !== "error";
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
      setWorkflows(list);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  // Check URL for pre-selected workflow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setSelectedId(id);
      setShowIntake(false);
    }
  }, []);

  // Handle new workflow submission
  const handleSubmit = async (input: WorkflowInput) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/workflow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to start workflow");
      const data = await res.json();
      const newId = data.workflowId || data.id;
      if (newId) {
        setSelectedId(newId);
        setShowIntake(false);
        // Update URL without reload
        window.history.pushState({}, "", `/workflow?id=${newId}`);
        // Refresh list
        setTimeout(fetchWorkflows, 1000);
      }
    } catch (err) {
      console.error("Failed to start workflow:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Map WorkflowSummary[] to WorkflowEntry[] for HistorySidebar
  // Also apply search filtering here before passing to sidebar
  const filteredEntries: WorkflowEntry[] = useMemo(() => {
    const filtered = workflows.filter((w) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        w.input.title.toLowerCase().includes(q) ||
        w.epicId.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q)
      );
    });

    return filtered.map((w) => ({
      id: w.id,
      phase: w.phase,
      epicId: w.epicId,
      title: w.input.title,
      startedAt: w.startedAt,
      completedAt: w.completedAt,
    }));
  }, [workflows, searchQuery]);

  const handleSelectWorkflow = (id: string) => {
    setSelectedId(id);
    setShowIntake(false);
    window.history.pushState({}, "", `/workflow?id=${id}`);
  };

  const handleNewWorkflow = () => {
    setSelectedId(null);
    setShowIntake(true);
    window.history.pushState({}, "", "/workflow");
  };

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6">
      {/* Left Sidebar — Collapsible/Resizable History */}
      <HistorySidebar
        workflows={filteredEntries}
        selectedId={selectedId}
        onSelectWorkflow={handleSelectWorkflow}
        onNewWorkflow={handleNewWorkflow}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {showIntake ? (
          <div className="p-8">
            <IntakeForm onSubmit={handleSubmit} isLoading={isSubmitting} />
          </div>
        ) : selectedId ? (
          <WorkflowBoard workflowId={selectedId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-brand-600/10 flex items-center justify-center mb-4">
              <Play className="w-7 h-7 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Select a workflow or start a new one
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-4">
              Choose a past run from the sidebar to view its pipeline state, or create a new workflow to watch agents work in real-time.
            </p>
            <button
              onClick={handleNewWorkflow}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
            >
              New Workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
