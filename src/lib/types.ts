// Aligned with ABCA schema (aws-samples/sample-autonomous-cloud-coding-agents)

export type TaskStatus =
  | "SUBMITTED"
  | "HYDRATING"
  | "RUNNING"
  | "FINALIZING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Task {
  task_id: string;
  status: TaskStatus;
  task_description: string;
  repo: string;
  issue_number?: number;
  pr_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  user_id: string;
  blueprint_id?: string;
}

export interface TaskEvent {
  event_id: string;
  task_id: string;
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  message?: string;
}

export interface Blueprint {
  blueprint_id: string;
  name: string;
  description: string;
  repo_pattern?: string;
  tools: string[];
  mcp_servers: string[];
  compute_type: "MICRO" | "STANDARD" | "LARGE";
  created_at: string;
  updated_at: string;
}

export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE" | "DEPLOYING" | "ERROR";
  blueprint_id: string;
  blueprint?: Blueprint;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  last_invoked?: string;
  created_at: string;
}

export interface MCPServer {
  server_id: string;
  name: string;
  description: string;
  endpoint: string;
  tools: string[];
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
}

export interface Workstream {
  id: string;
  name: string;
  type: "BACKEND" | "IOS" | "ANDROID" | "SECURITY" | "PRIVACY" | "ANALYTICS" | "LOCALIZATION";
  status: "TODO" | "IN_PROGRESS" | "DONE";
  task_id?: string;
  pr_url?: string;
  description: string;
}

export interface Epic {
  epic_id: string;
  title: string;
  description: string;
  status: "PLANNING" | "IN_PROGRESS" | "DONE";
  workstreams: Workstream[];
  created_at: string;
  source: "ONE_PAGER" | "PROTOTYPE" | "REQUIREMENTS" | "GITHUB_REPO";
}

export interface Metric {
  timestamp: string;
  invocations: number;
  avg_latency_ms: number;
  errors: number;
  success_rate: number;
}

export interface EvalResult {
  eval_id: string;
  agent_id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  score: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  started_at: string;
  completed_at?: string;
  results: EvalTestResult[];
}

export interface EvalTestResult {
  test_name: string;
  passed: boolean;
  expected: string;
  actual: string;
  duration_ms: number;
}
