/**
 * Workflow Module Exports
 *
 * Re-exports all workflow types and utilities for convenient importing.
 *
 * @example
 * ```typescript
 * import {
 *   WorkflowState,
 *   WorkflowInput,
 *   ModelConfig,
 *   isBedrockConfig,
 *   isValidModelConfig,
 * } from "@/lib/workflow";
 * ```
 */

// Types
export type {
  // Model Configuration
  ModelConfig,
  BedrockModelConfig,
  OpenAIModelConfig,
  GeminiModelConfig,
  ModelProvider,
  AvailableModel,

  // Jira/Ticket Types
  TicketType,
  TicketStatus,
  JiraTicket,
  JiraComment,
  Artifact,

  // Agent Types
  AgentPhase,
  AgentDefinition,
  AgentTaskStatus,
  AgentTask,
  AgentWorkspace,

  // Workflow Types
  WorkflowPhase,
  WorkflowState,
  WorkflowInput,
  WorkflowEvent,

  // Repo Configuration
  RepoLayout,
  RepoConfig,
  RepoTarget,

  // Intake
  IntakeSourceType,
  IntakeSource,

  // Messages & Notifications
  MessageType,
  AgentMessage,
  NotificationType,
  HumanNotification,
} from "./types";

// Type Guards and Utilities
export {
  // Type Guards
  isBedrockConfig,
  isOpenAIConfig,
  isGeminiConfig,
  isValidProvider,
  isValidModelConfig,
  isValidAvailableModel,

  // Constants
  SUPPORTED_PROVIDERS,

  // Conversion Utilities
  availableModelToConfig,
  describeModelConfig,
  modelConfigToLogString,
} from "./model-config-utils";
