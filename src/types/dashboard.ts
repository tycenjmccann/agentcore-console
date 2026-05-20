/**
 * Dashboard Metrics API — Shared types.
 * Used by both the backend API route and frontend consumers.
 */

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
