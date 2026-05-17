/**
 * Agentic Team Workflow — Core Types
 *
 * The workflow is ticket-driven: requirements agent creates tickets for
 * relevant agents only, and status transitions trigger invocations.
 */

// ─── Jira Mock System ────────────────────────────────────────────────────────

export type TicketType = "epic" | "story" | "task";

export type TicketStatus =
  | "backlog"
  | "todo"
  | "ready"       // agent should pick this up
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked";

export interface JiraTicket {
  id: string;                    // e.g., "TEAM-1"
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  assignee?: string;             // agent ID (e.g., "team-ios-designer")
  parent?: string;               // parent ticket ID
  children: string[];            // child ticket IDs
  blockedBy: string[];           // tickets that must be "done" before this can start
  comments: JiraComment[];
  artifacts: Artifact[];
  createdAt: string;
  updatedAt: string;
}

export interface JiraComment {
  id: string;
  author: string;                // agent ID or "human"
  content: string;
  timestamp: string;
}

export interface Artifact {
  id: string;
  type: "requirements" | "design" | "code" | "review" | "pr" | "other";
  title: string;
  content: string;               // inline content or S3 URI
  producedBy: string;            // agent ID
  timestamp: string;
}

// ─── Agent Definitions ───────────────────────────────────────────────────────

export type AgentPhase = "requirements" | "design" | "development" | "review";

export interface AgentDefinition {
  id: string;                    // e.g., "team-ios-designer"
  name: string;                  // display name: "iOS Designer"
  role: string;                  // short role description
  phase: AgentPhase;
  harnessName: string;           // AgentCore harness name for discovery/creation
  systemPrompt: string;
  tools: string[];               // tool names: ["a2a", "s3_read", "s3_write", "code_interpreter", "git"]
  canQueryAgents: string[];      // agent IDs this agent can A2A invoke
}

// ─── Workflow State ──────────────────────────────────────────────────────────

export type WorkflowPhase =
  | "intake"
  | "requirements"
  | "design"
  | "development"
  | "review"
  | "complete"
  | "error";

export type AgentTaskStatus =
  | "pending"
  | "running"
  | "waiting_response"
  | "complete"
  | "error";

export interface AgentTask {
  id: string;
  agentId: string;
  ticketId: string;
  status: AgentTaskStatus;
  input: string;                 // prompt/context sent to agent
  output?: string;               // agent response
  branch?: string;               // git branch created (dev agents)
  commitSha?: string;            // final commit SHA (dev agents)
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowState {
  id: string;                    // workflow run ID
  phase: WorkflowPhase;
  epicId: string;                // root Jira epic ticket ID
  repoConfig: RepoConfig;
  input: WorkflowInput;
  modelConfig?: ModelConfig;     // Optional: model config for dev agents (from input)
  agentTasks: Record<string, AgentTask>;  // keyed by agent ID
  messages: AgentMessage[];
  humanNotifications: HumanNotification[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ─── Repo Configuration ──────────────────────────────────────────────────────

export type RepoLayout = "monorepo" | "multi-repo";

export interface RepoConfig {
  layout: RepoLayout;
  repos: RepoTarget[];
}

export interface RepoTarget {
  url: string;                   // git remote URL
  defaultBranch: string;         // "main"
  pathPrefix?: string;           // for monorepo: "ios/", "backend/", etc.
  platform: "ios" | "backend" | "android" | "shared";
}

// ─── Agent Workspace ─────────────────────────────────────────────────────────

export interface AgentWorkspace {
  s3Bucket: string;
  s3Prefix: string;              // workflow-scoped prefix
  codeInterpreterSessionId?: string;
  gitBranch?: string;
}

// ─── Agent-to-Agent Messages ─────────────────────────────────────────────────

export type MessageType = "question" | "answer" | "notification";

export interface AgentMessage {
  id: string;
  from: string;                  // agent ID
  to: string;                    // agent ID
  type: MessageType;
  content: string;
  timestamp: string;
  resolved: boolean;
}

// ─── Model Configuration ─────────────────────────────────────────────────────

/**
 * Model configuration for AWS Bedrock models.
 */
export interface BedrockModelConfig {
  provider: "bedrock";
  modelId: string;
}

/**
 * Model configuration for OpenAI models.
 */
export interface OpenAiModelConfig {
  provider: "openai";
  modelId: string;
}

/**
 * Model configuration for Google Gemini models.
 */
export interface GeminiModelConfig {
  provider: "gemini";
  modelId: string;
}

/**
 * Union type representing all supported model configurations.
 * Uses discriminated union pattern with 'provider' as the discriminator.
 */
export type ModelConfig = BedrockModelConfig | OpenAiModelConfig | GeminiModelConfig;

// ─── Intake ──────────────────────────────────────────────────────────────────

export type IntakeSourceType = "url" | "upload" | "s3";

export interface IntakeSource {
  type: IntakeSourceType;
  value: string;                 // URL, file path, or s3://bucket/key
  contentType?: string;          // MIME type hint
  label?: string;                // user-provided label
}

export interface WorkflowInput {
  title: string;
  description: string;
  repoConfig: RepoConfig;
  sources: IntakeSource[];
  modelConfig?: ModelConfig;     // Optional: if omitted, uses default Bedrock Sonnet 4.5
}

// ─── Human Notifications ─────────────────────────────────────────────────────

export type NotificationType =
  | "phase_complete"
  | "blocker"
  | "review_needed"
  | "pr_ready"
  | "error";

export interface HumanNotification {
  id: string;
  type: NotificationType;
  title: string;
  details: string;
  timestamp: string;
  acknowledged: boolean;
}

// ─── SSE Events ──────────────────────────────────────────────────────────────

export type WorkflowEvent =
  | { type: "phase_change"; phase: WorkflowPhase }
  | { type: "agent_status"; agentId: string; status: AgentTaskStatus; ticketId?: string }
  | { type: "agent_output"; agentId: string; chunk: string }
  | { type: "agent_complete"; agentId: string; output: string; branch?: string; commitSha?: string }
  | { type: "message"; message: AgentMessage }
  | { type: "ticket_created"; ticket: JiraTicket }
  | { type: "ticket_update"; ticketId: string; status: TicketStatus }
  | { type: "notification"; notification: HumanNotification }
  | { type: "workflow_complete"; summary: string }
  | { type: "error"; agentId?: string; error: string };
