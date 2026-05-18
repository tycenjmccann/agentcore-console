/**
 * Pipeline Visualization Types
 * Types specific to the Architecture Pipeline board display.
 */
import type { WorkflowPhase, AgentTaskStatus } from "./types";

export type PhaseType = "app" | "agent";

export interface PipelinePhaseConfig {
  id: string;
  phaseNumber: number;
  name: string;
  phaseType: PhaseType;
  identity: PhaseIdentity;
  configDetails: ConfigDetail[];
  sections: PhaseSection[];
}

export interface PhaseIdentity {
  lines: string[];
  icons: ("agentcore" | "bedrock" | "s3" | "eventbridge" | "code-interpreter")[];
}

export interface ConfigDetail {
  key: string;
  value: string;
}

export interface PhaseSection {
  label: string;
  items: PipelineItem[];
}

export interface PipelineItem {
  id: string;
  label: string;
  icon?: "agentcore" | "bedrock" | "s3" | "eventbridge" | "code-interpreter";
  dot?: "skill" | "ext";
}

export type PipelineItemStatus = "idle" | "active" | "working" | "done" | "trigger";

export type PhaseStatus = "inactive" | "active" | "done";

export interface PipelineState {
  currentPhase: WorkflowPhase;
  phaseStatuses: Record<string, PhaseStatus>;
  itemStatuses: Record<string, PipelineItemStatus>;
  agentStatuses: Record<string, AgentTaskStatus>;
  statusText: string;
  statusPhase: string;
  celebrating: boolean;
}
