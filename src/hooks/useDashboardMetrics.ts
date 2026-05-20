"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cachedFetch, getCached } from "@/lib/client-cache";
import type { DashboardMetricsResponse } from "@/app/api/dashboard/metrics/types";

const DASHBOARD_METRICS_URL = "/api/dashboard/metrics";
const POLL_INTERVAL_MS = 30_000;

export interface UseDashboardMetricsReturn {
  data: DashboardMetricsResponse | null;
  loading: boolean;
  error: string | null;
}

export function useDashboardMetrics(): UseDashboardMetricsReturn {
  // Initialize from cache for instant render on back-navigation
  const [data, setData] = useState<DashboardMetricsResponse | null>(
    () => getCached<DashboardMetricsResponse>(DASHBOARD_METRICS_URL)
  );
  const [loading, setLoading] = useState<boolean>(
    !getCached(DASHBOARD_METRICS_URL)
  );
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = useCallback(async (isInitial: boolean) => {
    try {
      const result = await cachedFetch<DashboardMetricsResponse>(
        DASHBOARD_METRICS_URL,
        isInitial ? { forceRefresh: true } : undefined
      );
      setData(result);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch metrics";
      setError(message);
      // Retain last known data on error (don't setData(null))
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchMetrics(true);

    // Poll every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchMetrics(false);
    }, POLL_INTERVAL_MS);

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
