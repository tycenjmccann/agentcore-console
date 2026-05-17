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

export type ModelProvider = "bedrock" | "openai" | "gemini";

export interface BedrockConfig {
  provider: "bedrock";
  modelId: string;               // e.g., "anthropic.claude-sonnet-4-5-v1:0"
  region?: string;               // AWS region override (defaults to process.env.AWS_REGION)
}

export interface OpenAIConfig {
  provider: "openai";
  modelId: string;               // e.g., "gpt-4-turbo"
}

export interface GeminiConfig {
  provider: "gemini";
  modelId: string;               // e.g., "gemini-pro"
}

export type ModelConfig = BedrockConfig | OpenAIConfig | GeminiConfig;

// Type guards for ModelConfig discrimination
export function isBedrockConfig(config: ModelConfig): config is BedrockConfig {
  return config.provider === "bedrock";
}

export function isOpenAIConfig(config: ModelConfig): config is OpenAIConfig {
  return config.provider === "openai";
}

export function isGeminiConfig(config: ModelConfig): config is GeminiConfig {
  return config.provider === "gemini";
}

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
  modelOverride?: ModelConfig;   // optional model selection for dev agents
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
