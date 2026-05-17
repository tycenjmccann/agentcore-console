/**
 * Agentic Team Workflow — Core Types
 *
 * The workflow is ticket-driven: requirements agent creates tickets for
 * relevant agents only, and status transitions trigger invocations.
 */

// ─── Model Configuration ─────────────────────────────────────────────────────

/**
 * Provider-specific model configuration variants.
 *
 * This discriminated union allows type-safe handling of different AI model
 * providers, each with their own configuration requirements.
 *
 * @example
 * ```typescript
 * // AWS Bedrock model (default)
 * const bedrockModel: ModelConfig = {
 *   provider: "bedrock",
 *   modelId: "anthropic.claude-sonnet-4-5-v1:0",
 *   region: "us-west-2"
 * };
 *
 * // OpenAI model
 * const openaiModel: ModelConfig = {
 *   provider: "openai",
 *   modelId: "gpt-4-turbo",
 *   apiKeyRef: "OPENAI_API_KEY"
 * };
 *
 * // Gemini model
 * const geminiModel: ModelConfig = {
 *   provider: "gemini",
 *   modelId: "gemini-pro",
 *   apiKeyRef: "GEMINI_API_KEY"
 * };
 *
 * // Type-safe switch handling
 * function getProviderEndpoint(config: ModelConfig): string {
 *   switch (config.provider) {
 *     case "bedrock":
 *       return `https://bedrock.${config.region ?? "us-west-2"}.amazonaws.com`;
 *     case "openai":
 *       return "https://api.openai.com/v1";
 *     case "gemini":
 *       return "https://generativelanguage.googleapis.com/v1";
 *   }
 * }
 * ```
 */
export type ModelConfig =
  | BedrockModelConfig
  | OpenAIModelConfig
  | GeminiModelConfig;

/**
 * AWS Bedrock model configuration.
 *
 * Used for Claude models and other models available through AWS Bedrock.
 * Region is optional and defaults to the application's configured region.
 */
export interface BedrockModelConfig {
  /** Discriminant: identifies this as a Bedrock model configuration */
  provider: "bedrock";
  /**
   * Bedrock model identifier.
   * @example "anthropic.claude-sonnet-4-5-v1:0", "anthropic.claude-opus-4-v1:0"
   */
  modelId: string;
  /**
   * AWS region for the Bedrock endpoint.
   * Defaults to application's configured region if not specified.
   * @example "us-west-2", "us-east-1"
   */
  region?: string;
}

/**
 * OpenAI model configuration.
 *
 * Used for GPT models accessed through OpenAI's API.
 */
export interface OpenAIModelConfig {
  /** Discriminant: identifies this as an OpenAI model configuration */
  provider: "openai";
  /**
   * OpenAI model identifier.
   * @example "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"
   */
  modelId: string;
  /**
   * Environment variable name containing the OpenAI API key.
   * Server-side only - never exposed to client.
   * @example "OPENAI_API_KEY"
   */
  apiKeyRef?: string;
}

/**
 * Google Gemini model configuration.
 *
 * Used for Gemini models accessed through Google's API.
 */
export interface GeminiModelConfig {
  /** Discriminant: identifies this as a Gemini model configuration */
  provider: "gemini";
  /**
   * Gemini model identifier.
   * @example "gemini-pro", "gemini-ultra"
   */
  modelId: string;
  /**
   * Environment variable name containing the Gemini API key.
   * Server-side only - never exposed to client.
   * @example "GEMINI_API_KEY"
   */
  apiKeyRef?: string;
}

/**
 * Model information returned by the /api/models endpoint.
 *
 * Used by the UI to display available models in the model selector dropdown.
 *
 * @example
 * ```typescript
 * const models: AvailableModel[] = await fetch("/api/models").then(r => r.json());
 *
 * // Find the default model
 * const defaultModel = models.find(m => m.isDefault);
 *
 * // Group by provider for UI display
 * const grouped = models.reduce((acc, model) => {
 *   if (!acc[model.provider]) acc[model.provider] = [];
 *   acc[model.provider].push(model);
 *   return acc;
 * }, {} as Record<string, AvailableModel[]>);
 * ```
 */
export interface AvailableModel {
  /**
   * Model provider identifier.
   * Used to construct ModelConfig when user selects this model.
   */
  provider: ModelConfig["provider"];
  /**
   * Model identifier specific to the provider.
   * @example "anthropic.claude-sonnet-4-5-v1:0" for Bedrock
   */
  modelId: string;
  /**
   * Human-readable name for display in the UI.
   * @example "Claude Sonnet 4.5", "GPT-4 Turbo"
   */
  displayName: string;
  /**
   * Optional description providing additional context about the model.
   * @example "Balanced performance and cost", "Highest capability, slower"
   */
  description?: string;
  /**
   * Whether this is the default model selection.
   * Only one model should have isDefault=true.
   */
  isDefault: boolean;
}

/**
 * Supported model provider types.
 * Used for filtering and validation.
 */
export type ModelProvider = ModelConfig["provider"];

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

/**
 * Workflow execution state.
 *
 * Contains all information about a running or completed workflow,
 * including agent tasks, messages, and optional model configuration.
 *
 * @example
 * ```typescript
 * // Create workflow with model override
 * const state: WorkflowState = {
 *   id: "wf_12345",
 *   phase: "development",
 *   epicId: "TEAM-1",
 *   repoConfig: { layout: "monorepo", repos: [...] },
 *   input: { ... },
 *   modelOverride: {
 *     provider: "bedrock",
 *     modelId: "anthropic.claude-opus-4-v1:0"
 *   },
 *   agentTasks: {},
 *   messages: [],
 *   humanNotifications: [],
 *   startedAt: new Date().toISOString()
 * };
 *
 * // Check if model override applies to dev agents
 * if (state.modelOverride && agentPhase === "development") {
 *   // Use overridden model
 * }
 * ```
 */
export interface WorkflowState {
  id: string;                    // workflow run ID
  phase: WorkflowPhase;
  epicId: string;                // root Jira epic ticket ID
  repoConfig: RepoConfig;
  input: WorkflowInput;
  /**
   * Optional model configuration override for development agents.
   *
   * When set, development-phase agents will use this model instead of
   * the system default. Non-development agents (requirements, design,
   * review) always use the default model.
   *
   * @see ModelConfig for provider-specific configuration
   */
  modelOverride?: ModelConfig;
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
 * Workflow creation input.
 *
 * Contains all information needed to start a new workflow,
 * including optional model override for development agents.
 *
 * @example
 * ```typescript
 * // Create workflow with model override
 * const input: WorkflowInput = {
 *   title: "Feature: Add user authentication",
 *   description: "Implement OAuth2 login flow",
 *   repoConfig: {
 *     layout: "monorepo",
 *     repos: [{ url: "https://github.com/...", defaultBranch: "main", platform: "backend" }]
 *   },
 *   sources: [{ type: "url", value: "https://..." }],
 *   modelOverride: {
 *     provider: "bedrock",
 *     modelId: "anthropic.claude-opus-4-v1:0"
 *   }
 * };
 *
 * // Create workflow without override (uses default model)
 * const defaultInput: WorkflowInput = {
 *   title: "...",
 *   description: "...",
 *   repoConfig: { ... },
 *   sources: []
 *   // modelOverride is undefined, uses Claude Sonnet 4.5
 * };
 * ```
 */
export interface WorkflowInput {
  title: string;
  description: string;
  repoConfig: RepoConfig;
  sources: IntakeSource[];
  /**
   * Optional model configuration override for development agents.
   *
   * When set, development-phase agents will use this model instead of
   * the system default (Claude Sonnet 4.5). Non-development agents
   * (requirements, design, review) always use the default model.
   *
   * If omitted, all agents use the default model.
   *
   * @see ModelConfig for provider-specific configuration
   */
  modelOverride?: ModelConfig;
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
