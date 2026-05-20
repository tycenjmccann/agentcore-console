/**
 * TypeScript types for the Dashboard Metrics API response.
 * Exported for frontend consumption.
 */

export interface AgentActivity {
  invocations: number;
  sessions: number;
  avgDuration: number; // seconds
  totalDuration: number; // seconds
  activeAgents: number;
  tokens: null;
}

export interface TicketMetrics {
  resolved: number;
  inProgress: number;
  activeEpics: number;
  storiesDone: number;
  storiesActive: number;
  avgResolutionMinutes: number;
  throughputPerDay: number;
  automationRate: number;
}

export interface EpicSummary {
  workflowId: string;
  title: string;
  totalTickets: number;
  doneTickets: number;
  progress: number; // 0-100
}

export interface DashboardMetricsResponse {
  agentActivity: AgentActivity;
  tickets: TicketMetrics;
  epics: EpicSummary[];
  timestamp: string;
}
