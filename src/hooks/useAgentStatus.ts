"use client";

import { useState, useEffect, useCallback } from "react";

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: "active" | "idle" | "error" | string;
}

interface UseAgentStatusReturn {
  agents: Agent[];
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL = 30000; // 30 seconds

export function useAgentStatus(): UseAgentStatusReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agentcore/agents");
      if (!res.ok) {
        throw new Error(`Failed to fetch agents: ${res.status}`);
      }
      const data = await res.json();
      // API returns array of agents directly
      const agentList = Array.isArray(data) ? data : [];
      setAgents(agentList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();

    const interval = setInterval(fetchAgents, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [fetchAgents]);

  return { agents, loading, error };
}
