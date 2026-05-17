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
  /** Optional model configuration for development agents. Defaults to Bedrock Sonnet 4.5 if not specified. */
  modelConfig?: ModelConfig;
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


// ─── Model Configuration ─────────────────────────────────────────────────────

/**
 * Model configuration for AWS Bedrock models.
 * Bedrock provides access to Anthropic Claude models and other foundation models.
 * 
 * @example
 * {
 *   provider: 'bedrock',
 *   modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
 * }
 */
export type BedrockModelConfig = {
  /** Discriminator for Bedrock provider */
  provider: 'bedrock';
  /** 
   * Full Bedrock model identifier.
   * Format: global.{vendor}.{model-name}-{version}
   * Example: global.anthropic.claude-sonnet-4-5-20250929-v1:0
   */
  modelId: string;
};

/**
 * Model configuration for OpenAI models.
 * Supports GPT-4, GPT-3.5, and other OpenAI models.
 * 
 * @example
 * {
 *   provider: 'openai',
 *   modelId: 'gpt-4-turbo-preview'
 * }
 */
export type OpenAiModelConfig = {
  /** Discriminator for OpenAI provider */
  provider: 'openai';
  /** 
   * OpenAI model identifier.
   * Example: gpt-4-turbo-preview, gpt-3.5-turbo
   */
  modelId: string;
};

/**
 * Model configuration for Google Gemini models.
 * Supports Gemini Pro, Ultra, and other Google AI models.
 * 
 * @example
 * {
 *   provider: 'gemini',
 *   modelId: 'gemini-pro'
 * }
 */
export type GeminiModelConfig = {
  /** Discriminator for Gemini provider */
  provider: 'gemini';
  /** 
   * Gemini model identifier.
   * Example: gemini-pro, gemini-ultra
   */
  modelId: string;
};

/**
 * Union type representing all supported model configurations.
 * Uses discriminated union pattern with 'provider' as the discriminator field.
 * 
 * This type enables:
 * - Compile-time validation of provider-specific configurations
 * - Exhaustive pattern matching in switch statements
 * - Type narrowing based on provider field
 * 
 * @example
 * function processModel(config: ModelConfig) {
 *   switch (config.provider) {
 *     case 'bedrock':
 *       // TypeScript knows config.modelId is a Bedrock model ID
 *       invokeBedrock(config.modelId);
 *       break;
 *     case 'openai':
 *       invokeOpenAI(config.modelId);
 *       break;
 *     case 'gemini':
 *       invokeGemini(config.modelId);
 *       break;
 *     default:
 *       // Exhaustiveness check - TypeScript error if new provider added
 *       const _exhaustive: never = config;
 *       throw new Error(`Unsupported provider: ${_exhaustive}`);
 *   }
 * }
 */
export type ModelConfig = BedrockModelConfig | OpenAiModelConfig | GeminiModelConfig;

/**
 * Default Bedrock model configuration (Claude Sonnet 4.5).
 * Used as fallback when no model is specified.
 */
export const DEFAULT_MODEL_CONFIG: BedrockModelConfig = {
  provider: 'bedrock',
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
};

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
