/**
 * React hook for workflow list with pagination, filtering, and real-time updates.
 *
 * Used by the collapsible history sidebar to efficiently fetch and manage
 * workflow list data with support for:
 *   - Cursor-based pagination (infinite scroll)
 *   - Search/filter
 *   - Auto-refresh on interval
 *   - Optimistic updates
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  WorkflowListItem,
  WorkflowListParams,
  WorkflowListResponse,
  WorkflowStats,
} from "@/lib/workflow/api-types";

interface UseWorkflowListOptions {
  /** Auto-refresh interval in ms (default: 5000, set 0 to disable) */
  refreshInterval?: number;
  /** Initial filter status */
  initialStatus?: WorkflowListParams["status"];
  /** Items per page */
  pageSize?: number;
}

interface UseWorkflowListReturn {
  /** Current list of workflows */
  workflows: WorkflowListItem[];
  /** Workflow statistics */
  stats: WorkflowStats | null;
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether more pages are being loaded */
  isLoadingMore: boolean;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Current search query */
  searchQuery: string;
  /** Current status filter */
  statusFilter: WorkflowListParams["status"];
  /** Error if last fetch failed */
  error: string | null;
  /** Load next page (for infinite scroll) */
  loadMore: () => void;
  /** Update search query */
  setSearchQuery: (query: string) => void;
  /** Update status filter */
  setStatusFilter: (status: WorkflowListParams["status"]) => void;
  /** Force refresh the list */
  refresh: () => void;
}

export function useWorkflowList(options: UseWorkflowListOptions = {}): UseWorkflowListReturn {
  const {
    refreshInterval = 5000,
    initialStatus = "all",
    pageSize = 20,
  } = options;

  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowListParams["status"]>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Build query string from params
  const buildQuery = useCallback(
    (params: { cursor?: string | null } = {}) => {
      const searchParams = new URLSearchParams();
      searchParams.set("limit", pageSize.toString());
      searchParams.set("includeStats", "true");

      if (params.cursor) {
        searchParams.set("cursor", params.cursor);
      }
      if (searchQuery) {
        searchParams.set("search", searchQuery);
      }
      if (statusFilter && statusFilter !== "all") {
        searchParams.set("status", statusFilter);
      }

      return searchParams.toString();
    },
    [pageSize, searchQuery, statusFilter]
  );

  // Fetch workflows
  const fetchWorkflows = useCallback(
    async (isLoadMore = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const query = buildQuery({ cursor: isLoadMore ? cursor : null });
        const res = await fetch(`/api/workflow/list?${query}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`);
        }

        const data: WorkflowListResponse = await res.json();

        if (isLoadMore) {
          setWorkflows((prev) => [...prev, ...data.workflows]);
        } else {
          setWorkflows(data.workflows);
        }

        setHasMore(data.pagination.hasMore);
        setCursor(data.pagination.nextCursor);

        if (data.stats) {
          setStats(data.stats);
        }

        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [buildQuery, cursor]
  );

  // Initial fetch and refresh on filter changes
  useEffect(() => {
    fetchWorkflows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    refreshTimerRef.current = setInterval(() => {
      // Only refresh first page (don't disrupt pagination)
      fetchWorkflows(false);
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      fetchWorkflows(true);
    }
  }, [hasMore, isLoadingMore, fetchWorkflows]);

  const refresh = useCallback(() => {
    setCursor(null);
    fetchWorkflows(false);
  }, [fetchWorkflows]);

  return {
    workflows,
    stats,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    statusFilter,
    error,
    loadMore,
    setSearchQuery,
    setStatusFilter,
    refresh,
  };
}
