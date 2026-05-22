/**
 * Agent Roster — Config-driven agent definitions.
 *
 * Structural config (id, name, role, phase, tools, etc.) lives in src/config/agents.json.
 * System prompts live in src/config/agent-prompts.ts for readability and template literal support.
 * This module merges them at load time to produce the same AGENT_ROSTER export.
 */

import type { AgentDefinition } from "./types";
import agentConfig from "../../config/agents.json";
import { AGENT_PROMPTS } from "../../config/agent-prompts";

// ─── Types for the JSON config ──────────────────────────────────────────────

interface AgentJsonEntry {
  id: string;
  name: string;
  role: string;
  phase: string;
  harnessName: string;
  tools: string[];
  canQueryAgents: string[];
  keywords: string[];
}

interface AgentConfigJson {
  agents: AgentJsonEntry[];
  defaults: {
    intakeAgentId: string;
    defaultAssigneeId: string;
  };
}

// ─── Merge config + prompts into AgentDefinition[] ──────────────────────────

const config = agentConfig as AgentConfigJson;

export const AGENT_ROSTER: AgentDefinition[] = config.agents.map((entry) => ({
  id: entry.id,
  name: entry.name,
  role: entry.role,
  phase: entry.phase as AgentDefinition["phase"],
  harnessName: entry.harnessName,
  systemPrompt: AGENT_PROMPTS[entry.id] ?? "",
  tools: entry.tools,
  canQueryAgents: entry.canQueryAgents,
}));

/**
 * Top-level agent configuration defaults.
 */
export const AGENT_CONFIG = config.defaults;

/**
 * Get an agent definition by ID.
 */
export function getAgentDef(id: string): AgentDefinition | undefined {
  return AGENT_ROSTER.find((a) => a.id === id);
}

/**
 * Get all agents for a specific phase.
 */
export function getAgentsForPhase(phase: AgentDefinition["phase"]): AgentDefinition[] {
  return AGENT_ROSTER.filter((a) => a.phase === phase);
}

/**
 * Get agent by harness name (for mapping discovered harnesses back to definitions).
 */
export function getAgentByHarnessName(name: string): AgentDefinition | undefined {
  return AGENT_ROSTER.find((a) => a.harnessName === name);
}
