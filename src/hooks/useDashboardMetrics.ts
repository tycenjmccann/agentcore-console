import { useState, useEffect, useRef, useCallback } from "react";

export interface DashboardMetricsResponse {
  agentActivity: {
    invocations: number;
    sessions: number;
    avgDuration: number;
    totalDuration: number;
    activeAgents: number;
    tokens: null;
  };
  tickets: {
    resolved: number;
    inProgress: number;
    activeEpics: number;
    storiesDone: number;
    storiesActive: number;
    avgResolutionMs: number;
    throughput: number;
    automationRate: number;
  };
  epics: Array<{
    workflowId: string;
    title: string;
    totalTickets: number;
    doneTickets: number;
    color: string;
  }>;
  cachedAt: string;
}

const POLL_INTERVAL_MS = 30_000;

export function useDashboardMetrics() {
  const [data, setData] = useState<DashboardMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstFetch = useRef<boolean>(true);

  const fetchMetrics = useCallback(async () => {
    // Only set loading on first fetch (no loading flash on subsequent polls)
    if (isFirstFetch.current) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/dashboard/metrics");
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard metrics: ${response.status} ${response.statusText}`);
      }
      const json: DashboardMetricsResponse = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      // Preserve last known data on error
      const message = err instanceof Error ? err.message : "Unknown error fetching dashboard metrics";
      setError(message);
    } finally {
      if (isFirstFetch.current) {
        isFirstFetch.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Fetch on mount
    fetchMetrics();

    // Set up polling every 30 seconds
    intervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchMetrics]);

  return { data, loading, error };
}
