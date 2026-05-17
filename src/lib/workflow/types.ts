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

// ─── Model Configuration ─────────────────────────────────────────────────────

/**
 * Bedrock model configuration using IAM authentication.
 * No API key required - uses AWS IAM credentials.
 */
export interface BedrockModelConfig {
  type: 'bedrock';
  modelId: string;
}

/**
 * OpenAI model configuration requiring API key from Token Vault.
 * API key is never stored directly - only ARN reference.
 */
export interface OpenAIModelConfig {
  type: 'openai';
  modelId: string;
  apiKeyArn: string;
}

/**
 * Google Gemini model configuration requiring API key from Token Vault.
 * API key is never stored directly - only ARN reference.
 */
export interface GeminiModelConfig {
  type: 'gemini';
  modelId: string;
  apiKeyArn: string;
}

/**
 * Discriminated union of all supported model configurations.
 * Use the 'type' discriminator for type narrowing.
 */
export type ModelConfig = 
  | BedrockModelConfig 
  | OpenAIModelConfig 
  | GeminiModelConfig;

/**
 * Model provider availability status
 * Used by frontend to determine which models to enable
 */
export interface ProviderAvailability {
  bedrock: boolean; // Always true (IAM auth)
  openai: boolean; // True if OPENAI_API_KEY_ARN is configured
  gemini: boolean; // True if GEMINI_API_KEY_ARN is configured
}

/**
 * Model definition for UI display
 */
export interface ModelDefinition {
  id: string;
  name: string;
  provider: 'bedrock' | 'openai' | 'gemini';
  displayName: string;
  description?: string;
}

/**
 * Bedrock Model IDs (Full ARN format)
 */
export const BEDROCK_MODELS = {
  CLAUDE_SONNET_4_5: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  CLAUDE_OPUS_4_5: 'global.anthropic.claude-opus-4-5-20250201-v1:0',
  CLAUDE_HAIKU_4_5: 'global.anthropic.claude-haiku-4-5-20250201-v1:0',
  NOVA_PRO: 'global.amazon.nova-pro-v1:0',
  NOVA_LITE: 'global.amazon.nova-lite-v1:0',
} as const;

/**
 * OpenAI Model IDs
 */
export const OPENAI_MODELS = {
  GPT_5_5: 'gpt-5.5',
  O3: 'o3',
  O4_MINI: 'o4-mini',
} as const;

/**
 * Google Gemini Model IDs
 */
export const GEMINI_MODELS = {
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
} as const;

/**
 * Complete model registry for UI
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  // Bedrock models
  { id: BEDROCK_MODELS.CLAUDE_SONNET_4_5, name: 'Claude Sonnet 4.5', provider: 'bedrock', displayName: 'Claude Sonnet 4.5', description: 'Recommended - Balanced performance' },
  { id: BEDROCK_MODELS.CLAUDE_OPUS_4_5, name: 'Claude Opus 4.5', provider: 'bedrock', displayName: 'Claude Opus 4.5', description: 'Most capable model' },
  { id: BEDROCK_MODELS.CLAUDE_HAIKU_4_5, name: 'Claude Haiku 4.5', provider: 'bedrock', displayName: 'Claude Haiku 4.5', description: 'Fast and cost-effective' },
  { id: BEDROCK_MODELS.NOVA_PRO, name: 'Amazon Nova Pro', provider: 'bedrock', displayName: 'Amazon Nova Pro' },
  { id: BEDROCK_MODELS.NOVA_LITE, name: 'Amazon Nova Lite', provider: 'bedrock', displayName: 'Amazon Nova Lite' },
  // OpenAI models
  { id: OPENAI_MODELS.GPT_5_5, name: 'GPT-5.5', provider: 'openai', displayName: 'GPT-5.5' },
  { id: OPENAI_MODELS.O3, name: 'o3', provider: 'openai', displayName: 'o3' },
  { id: OPENAI_MODELS.O4_MINI, name: 'o4-mini', provider: 'openai', displayName: 'o4-mini' },
  // Gemini models
  { id: GEMINI_MODELS.GEMINI_2_5_PRO, name: 'Gemini 2.5 Pro', provider: 'gemini', displayName: 'Gemini 2.5 Pro' },
  { id: GEMINI_MODELS.GEMINI_2_5_FLASH, name: 'Gemini 2.5 Flash', provider: 'gemini', displayName: 'Gemini 2.5 Flash' },
];

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_CONFIG: BedrockModelConfig = {
  type: 'bedrock',
  modelId: BEDROCK_MODELS.CLAUDE_SONNET_4_5,
};

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
  modelConfig?: ModelConfig;     // optional model configuration for workflow agents
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
  modelConfig?: ModelConfig;     // optional model configuration
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
