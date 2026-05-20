"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

export interface Workflow {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | string;
  createdAt: string;
  updatedAt?: string;
}

export type WorkflowFilter = "all" | "running" | "completed" | "failed";

interface UseWorkflowHistoryReturn {
  workflows: Workflow[];
  filteredWorkflows: Workflow[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: WorkflowFilter;
  setActiveFilter: (filter: WorkflowFilter) => void;
}

const DEBOUNCE_DELAY = 300;

export function useWorkflowHistory(): UseWorkflowHistoryReturn {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<WorkflowFilter>("all");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow/list");
      if (!res.ok) {
        throw new Error(`Failed to fetch workflows: ${res.status}`);
      }
      const data = await res.json();
      const workflowList = Array.isArray(data.workflows) ? data.workflows : [];
      setWorkflows(workflowList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const filteredWorkflows = useMemo(() => {
    let result = workflows;

    // Apply status filter
    if (activeFilter !== "all") {
      result = result.filter((w) => w.status === activeFilter);
    }

    // Apply search filter
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      result = result.filter((w) =>
        w.name?.toLowerCase().includes(query)
      );
    }

    // Return max 10 items
    return result.slice(0, 10);
  }, [workflows, activeFilter, debouncedQuery]);

  return {
    workflows,
    filteredWorkflows,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
  };
}
