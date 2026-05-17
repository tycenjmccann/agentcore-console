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

// ─── Model Configuration ────────────────────────────────────────────────────

/**
 * Supported AI model providers.
 * @description Discriminator type for the ModelConfig union.
 */
export type ModelProvider = "bedrock" | "openai" | "gemini";

/**
 * Configuration for AWS Bedrock models.
 * @description Used for Claude Sonnet, Claude Opus, and other Bedrock-hosted models.
 * @example
 * const config: BedrockModelConfig = {
 *   provider: "bedrock",
 *   modelId: "anthropic.claude-sonnet-4-5-v1"
 * };
 */
export interface BedrockModelConfig {
  /** Discriminator: always "bedrock" for Bedrock models */
  provider: "bedrock";
  /** 
   * The Bedrock model identifier.
   * @example "anthropic.claude-sonnet-4-5-v1", "anthropic.claude-opus-4"
   */
  modelId: string;
}

/**
 * Configuration for OpenAI models.
 * @description Used for GPT-4, GPT-4 Turbo, and other OpenAI models.
 * @example
 * const config: OpenAIModelConfig = {
 *   provider: "openai",
 *   modelId: "gpt-4-turbo"
 * };
 */
export interface OpenAIModelConfig {
  /** Discriminator: always "openai" for OpenAI models */
  provider: "openai";
  /** 
   * The OpenAI model identifier.
   * @example "gpt-4", "gpt-4-turbo"
   */
  modelId: string;
  /** 
   * Optional API key override. 
   * If not provided, uses the server-configured default.
   * @remarks This should be handled server-side only, never exposed to client.
   */
  apiKey?: string;
}

/**
 * Configuration for Google Gemini models.
 * @description Used for Gemini Pro, Gemini Ultra, and other Google AI models.
 * @example
 * const config: GeminiModelConfig = {
 *   provider: "gemini",
 *   modelId: "gemini-pro"
 * };
 */
export interface GeminiModelConfig {
  /** Discriminator: always "gemini" for Gemini models */
  provider: "gemini";
  /** 
   * The Gemini model identifier.
   * @example "gemini-pro", "gemini-ultra"
   */
  modelId: string;
  /** 
   * Optional API key override.
   * If not provided, uses the server-configured default.
   * @remarks This should be handled server-side only, never exposed to client.
   */
  apiKey?: string;
}

/**
 * Discriminated union of all supported model configurations.
 * @description Use the `provider` field as the discriminator to narrow the type.
 * @example
 * function getModelName(config: ModelConfig): string {
 *   switch (config.provider) {
 *     case "bedrock": return config.modelId;
 *     case "openai": return `OpenAI ${config.modelId}`;
 *     case "gemini": return `Gemini ${config.modelId}`;
 *   }
 * }
 */
export type ModelConfig = BedrockModelConfig | OpenAIModelConfig | GeminiModelConfig;

/**
 * Default model configuration used when no model is specified.
 * @description Points to Claude Sonnet 4.5 on Bedrock as the default model.
 */
export const DEFAULT_MODEL: BedrockModelConfig = {
  provider: "bedrock",
  modelId: "anthropic.claude-sonnet-4-5-v1"
} as const;

// ─── Model Type Guards ──────────────────────────────────────────────────────

/**
 * Type guard to check if a ModelConfig is a BedrockModelConfig.
 * @param config - The model configuration to check
 * @returns True if the config is for a Bedrock model
 * @example
 * if (isBedrockModel(config)) {
 *   // config.provider is narrowed to "bedrock"
 *   console.log(config.modelId);
 * }
 */
export function isBedrockModel(config: ModelConfig): config is BedrockModelConfig {
  return config.provider === "bedrock";
}

/**
 * Type guard to check if a ModelConfig is an OpenAIModelConfig.
 * @param config - The model configuration to check
 * @returns True if the config is for an OpenAI model
 * @example
 * if (isOpenAIModel(config)) {
 *   // config.provider is narrowed to "openai"
 *   console.log(config.apiKey); // optional field available
 * }
 */
export function isOpenAIModel(config: ModelConfig): config is OpenAIModelConfig {
  return config.provider === "openai";
}

/**
 * Type guard to check if a ModelConfig is a GeminiModelConfig.
 * @param config - The model configuration to check
 * @returns True if the config is for a Gemini model
 * @example
 * if (isGeminiModel(config)) {
 *   // config.provider is narrowed to "gemini"
 *   console.log(config.apiKey); // optional field available
 * }
 */
export function isGeminiModel(config: ModelConfig): config is GeminiModelConfig {
  return config.provider === "gemini";
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

/**
 * Input data for starting a new workflow.
 * @description Contains all information needed to initialize a workflow run.
 */
export interface WorkflowInput {
  /** Title of the feature/project being worked on */
  title: string;
  /** Detailed description of the requirements */
  description: string;
  /** Repository configuration for code changes */
  repoConfig: RepoConfig;
  /** Source materials (URLs, uploads, S3 files) for requirements analysis */
  sources: IntakeSource[];
  /**
   * Optional model configuration for dev agents.
   * @description When specified, dev agents will use this model instead of the default.
   * If not provided, defaults to Claude Sonnet 4.5 (DEFAULT_MODEL).
   * @remarks Only applies to development phase agents; requirements and design 
   * agents always use the default model for consistency.
   */
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
