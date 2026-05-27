/**
 * Pipeline Configuration
 *
 * This file defines HOW to DISPLAY the pipeline — purely visual/UI concerns.
 * Agent data (who exists, what tools they have) comes from agents.json (single source of truth).
 *
 * To customize for your environment:
 * 1. Deploy your AgentCore harness agents
 * 2. Update src/config/agents.json with your agent IDs and harness names
 * 3. Update TOOL_ICON_MAP below if you add custom gateway tools
 * 4. Update PHASE_DISPLAY_META if you change phase display properties
 */

import agentsConfig from "@/config/agents.json";

// ─── Tool → Icon Mapping ────────────────────────────────────────────────────
// Maps gateway tool name prefixes to the AWS icon key used in the visualization.
// When a tool_use event fires, we match it here to determine which icon to flash.

export const TOOL_ICON_MAP: Record<string, { icon: string; label: string }> = {
  // S3 tools
  "S3Storage___read_object": { icon: "s3", label: "S3 Read" },
  "S3Storage___write_object": { icon: "s3", label: "S3 Write" },
  "S3Storage___list_objects": { icon: "s3", label: "S3 List" },

  // Skill loader (flashes the skill dot)
  "SkillLoader___load_skill": { icon: "skill", label: "Load Skill" },

  // GitHub integration (via MCP)
  "get_file_contents": { icon: "github", label: "GitHub Read" },
  "create_or_update_file": { icon: "github", label: "GitHub Commit" },
  "create_branch": { icon: "github", label: "GitHub Branch" },
  "create_pull_request": { icon: "github", label: "GitHub PR" },
  "search_code": { icon: "github", label: "GitHub Search" },
  "push_files": { icon: "github", label: "GitHub Push" },
  "list_commits": { icon: "github", label: "GitHub Commits" },

  // Workflow output
  "WorkflowOutput___submit_ticket_plan": { icon: "agentcore", label: "Submit Plan" },
  "WorkflowOutput___report_completion": { icon: "agentcore", label: "Report Complete" },
  "WorkflowOutput___save_design_doc": { icon: "agentcore", label: "Save Design" },

  // Ticket tools
  "Tickets___create_ticket": { icon: "ticket", label: "Create Ticket" },
  "Tickets___transition_ticket": { icon: "ticket", label: "Transition Ticket" },
  "Tickets___update_ticket": { icon: "ticket", label: "Update Ticket" },
  "Tickets___list_tickets": { icon: "ticket", label: "List Tickets" },
  "Tickets___add_comment": { icon: "ticket", label: "Add Comment" },
  "Tickets___search_issues": { icon: "ticket", label: "Search Tickets" },

  // Code interpreter (AgentCore sandbox)
  "code_interpreter": { icon: "codebuild", label: "Code Interpreter" },

  // Browser (AgentCore sandbox)
  "browser": { icon: "agentcore", label: "Browser" },

  // Claude Code
  "claude_code": { icon: "claude", label: "Claude Code" },
};

// ─── Phase Display Order ────────────────────────────────────────────────────
// Defines the left-to-right ordering of phases in the visualization.

export type PipelinePhaseId = "intake" | "requirements" | "design" | "development" | "qa";

export const PHASE_DISPLAY_ORDER: PipelinePhaseId[] = [
  "intake",
  "requirements",
  "design",
  "development",
  "qa",
];

// ─── Phase Display Metadata ─────────────────────────────────────────────────
// Per-phase UI metadata: how to render each phase visually.
// Agent lists are NOT here — they are derived from agents.json.

export interface PipelineIdentityItem {
  icon: string;
  label: string;
}

export interface PipelineConfigItem {
  key: string;
  val: string;
}

export interface PipelineDisplayItem {
  icon?: string;
  dot?: "skill" | "ext";
  label: string;
}

interface PhaseDisplayMeta {
  name: string;
  type: "app" | "agent";
  /** Maps phase ID to the agentPhase key used in workflow state */
  agentPhase: string;
  identity: PipelineIdentityItem[];
  config: PipelineConfigItem[];
  tools: PipelineDisplayItem[];
  skills: string[];
  outputs: PipelineDisplayItem[];
  models: string[];
  evaluationsEnabled: boolean;
}

export const PHASE_DISPLAY_META: Record<PipelinePhaseId, PhaseDisplayMeta> = {
  intake: {
    name: "Intake",
    type: "app",
    agentPhase: "intake",
    identity: [{ icon: "", label: "Next.js 14 / App Router" }],
    config: [
      { key: "Host", val: "localhost:3000" },
      { key: "Storage", val: "S3 multipart upload" },
      { key: "Trigger", val: "EventBridge on epic create" },
    ],
    tools: [
      { dot: "ext", label: "Upload PRD / Mockup / Figma" },
      { dot: "ext", label: "Set Target Git Repo" },
      { icon: "s3", label: "S3 Artifact Storage" },
    ],
    skills: [],
    outputs: [{ icon: "eventbridge", label: "Jira Epic Created (EventBridge)" }],
    models: [],
    evaluationsEnabled: false,
  },
  requirements: {
    name: "Requirements",
    type: "agent",
    agentPhase: "requirements",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime" },
      { icon: "bedrock", label: "Claude Opus 4 (via Bedrock)" },
    ],
    config: [
      { key: "Model", val: "us.anthropic.claude-opus-4-0-v1" },
      { key: "Max turns", val: "50" },
      { key: "Timeout", val: "15 min" },
    ],
    tools: [
      { icon: "agentcore", label: "Built-in (Strands)" },
      { icon: "s3", label: "S3 Storage" },
      { icon: "jira", label: "Jira" },
      { icon: "github", label: "GitHub (MCP)" },
      { icon: "claude", label: "Claude Code" },
      { icon: "agentcore", label: "Workflow Output" },
    ],
    skills: [
      "Requirements Analysis",
    ],
    outputs: [
      { icon: "s3", label: "S3 Artifacts" },
      { icon: "agentcore", label: "report_completion" },
    ],
    models: ["Claude Opus 4.6"],
    evaluationsEnabled: true,
  },
  design: {
    name: "Design",
    type: "agent",
    agentPhase: "design",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime (x8 parallel)" },
      { icon: "bedrock", label: "Claude Opus 4 / Sonnet 4" },
    ],
    config: [
      { key: "Dispatch", val: "parallel fan-out, 8 runtimes" },
      { key: "Branch", val: "feature/{ticket}-{role}" },
    ],
    tools: [
      { icon: "agentcore", label: "Built-in (Strands)" },
      { icon: "s3", label: "S3 Storage" },
      { icon: "github", label: "GitHub (MCP)" },
      { icon: "claude", label: "Claude Code" },
      { icon: "agentcore", label: "Workflow Output" },
    ],
    skills: [
      "iOS Architecture",
      "Backend Systems",
      "Frontend Design",
      "Privacy & Compliance",
      "Localization",
      "General Design",
      "Code Architect",
    ],
    outputs: [
      { icon: "s3", label: "S3 Artifacts" },
      { icon: "agentcore", label: "save_design_doc" },
    ],
    models: ["Claude Opus 4.6", "Claude Sonnet 4.6"],
    evaluationsEnabled: true,
  },
  development: {
    name: "Development",
    type: "agent",
    agentPhase: "development",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime (x3 parallel)" },
      { icon: "bedrock", label: "Claude Opus 4 / Sonnet 4" },
    ],
    config: [
      { key: "Dispatch", val: "parallel fan-out, 3 runtimes" },
      { key: "Branch", val: "feature/{ticket}-{role}" },
    ],
    tools: [
      { icon: "agentcore", label: "Built-in (Strands)" },
      { icon: "s3", label: "S3 Storage" },
      { icon: "github", label: "GitHub (MCP)" },
      { icon: "claude", label: "Claude Code" },
      { icon: "agentcore", label: "Workflow Output" },
    ],
    skills: [
      "Swift Development",
      "Node.js / TypeScript",
      "Full-Stack",
      "Feature Dev",
    ],
    outputs: [
      { icon: "s3", label: "S3 Artifacts" },
      { icon: "github", label: "Git Commits / PRs" },
      { icon: "agentcore", label: "report_completion" },
    ],
    models: ["Claude Opus 4.6", "Claude Sonnet 4.6"],
    evaluationsEnabled: true,
  },
  qa: {
    name: "QA & Ship",
    type: "agent",
    agentPhase: "verification",
    identity: [
      { icon: "agentcore", label: "AgentCore Runtime (x2 parallel)" },
      { icon: "bedrock", label: "Claude Opus 4 / Sonnet 4" },
    ],
    config: [
      { key: "Dispatch", val: "sequential then parallel" },
      { key: "Retry", val: "3x fix cycles before escalation" },
    ],
    tools: [
      { icon: "agentcore", label: "Built-in (Strands)" },
      { icon: "s3", label: "S3 Storage" },
      { icon: "jira", label: "Jira" },
      { icon: "github", label: "GitHub (MCP)" },
      { icon: "claude", label: "Claude Code" },
      { icon: "agentcore", label: "Workflow Output" },
    ],
    skills: [
      "QA Verification",
      "CI Verification",
    ],
    outputs: [
      { icon: "s3", label: "S3 Artifacts" },
      { icon: "agentcore", label: "report_completion" },
    ],
    models: ["Claude Opus 4.6", "Claude Sonnet 4.6"],
    evaluationsEnabled: true,
  },
};

// ─── Agent Config Interface ─────────────────────────────────────────────────

export interface PipelineAgentConfig {
  /** Agent ID — must match AGENT_ROSTER id and WorkflowState.agentTasks keys */
  id: string;
  /** Display name shown in pipeline */
  displayName: string;
  /** Agent type: "runtime" (AgentCore Runtime) or "harness" (AgentCore Harness) */
  type: "runtime" | "harness";
  /** Model used by this agent (e.g. "Claude Opus 4.6") */
  model: string;
  /** AgentCore harness name (used for discovery) */
  harnessName: string;
  /** Tools this agent has access to (used to determine which icons to flash) */
  tools: string[];
}

// ─── Pipeline Phase Config (derived) ────────────────────────────────────────

export interface PipelinePhaseConfig {
  id: PipelinePhaseId;
  name: string;
  num: number;
  type: "app" | "agent";
  typeLabel: string;
  agentPhase: string;
  identity: PipelineIdentityItem[];
  config: PipelineConfigItem[];
  tools: PipelineDisplayItem[];
  agents: PipelineAgentConfig[];
  skills: string[];
  outputs: PipelineDisplayItem[];
  models: string[];
  runtimeAgentCount: number;
  harnessAgentCount: number;
}

// ─── Phase-to-agentPhase mapping ────────────────────────────────────────────
// Maps agents.json phase values to pipeline phase IDs.
// agents.json uses "verification" and "review" for QA agents.

const AGENT_PHASE_TO_PIPELINE_PHASE: Record<string, PipelinePhaseId> = {
  requirements: "requirements",
  design: "design",
  development: "development",
  verification: "qa",
  review: "qa",
};

// ─── Helper: Phase-level counts ─────────────────────────────────────────────

const EXCLUDED_TOOLS = new Set(["gateway", "browser", "invoke_team_agent"]);

/** Count unique tools for a phase, excluding "gateway", "browser", "invoke_team_agent" */
export function getPhaseToolCount(phaseId: PipelinePhaseId): number {
  const tools = new Set<string>();
  for (const agent of agentsConfig.agents) {
    const mappedPhase = AGENT_PHASE_TO_PIPELINE_PHASE[agent.phase];
    if (mappedPhase === phaseId) {
      for (const tool of agent.tools) {
        if (!EXCLUDED_TOOLS.has(tool)) {
          tools.add(tool);
        }
      }
    }
  }
  return tools.size;
}

/** Count skills for a phase */
export function getPhaseSkillCount(phaseId: PipelinePhaseId): number {
  return PHASE_DISPLAY_META[phaseId].skills.length;
}

/** Count runtime agents (total agents in this phase) */
export function getPhaseRuntimeAgentCount(phaseId: PipelinePhaseId): number {
  return agentsConfig.agents.filter((a) => {
    const mappedPhase = AGENT_PHASE_TO_PIPELINE_PHASE[a.phase];
    return mappedPhase === phaseId;
  }).length;
}

/** Count harness agents (agents with type === "harness") */
export function getPhaseHarnessAgentCount(phaseId: PipelinePhaseId): number {
  return agentsConfig.agents.filter((a) => {
    const mappedPhase = AGENT_PHASE_TO_PIPELINE_PHASE[a.phase];
    return mappedPhase === phaseId && a.type === "harness";
  }).length;
}

// ─── Derive PIPELINE_PHASES from agents.json + display metadata ─────────────

function buildPipelinePhases(): PipelinePhaseConfig[] {
  return PHASE_DISPLAY_ORDER.map((phaseId, idx) => {
    const meta = PHASE_DISPLAY_META[phaseId];

    // Derive agents for this phase from agents.json
    const agents: PipelineAgentConfig[] = agentsConfig.agents
      .filter((a) => {
        const mappedPhase = AGENT_PHASE_TO_PIPELINE_PHASE[a.phase];
        return mappedPhase === phaseId;
      })
      .map((a) => ({
        id: a.id,
        displayName: a.name,
        type: (a.type || "runtime") as "runtime" | "harness",
        model: a.model || "",
        harnessName: a.harnessName,
        tools: a.tools.filter((t) => t !== "gateway" && t !== "invoke_team_agent" && t !== "browser"),
      }));

    // Generate typeLabel dynamically
    let typeLabel: string;
    if (meta.type === "app") {
      typeLabel = "Web Application";
    } else {
      const runtimeCount = agents.filter((a) => a.type === "runtime").length;
      const harnessCount = agents.filter((a) => a.type === "harness").length;
      const parts: string[] = [];
      if (runtimeCount > 0) parts.push(`${runtimeCount} Runtime Agent${runtimeCount !== 1 ? "s" : ""}`);
      if (harnessCount > 0) parts.push(`${harnessCount} Harness Agent${harnessCount !== 1 ? "s" : ""}`);
      typeLabel = parts.join(" + ") || `${agents.length} Agents`;
    }

    return {
      id: phaseId,
      name: meta.name,
      num: idx + 1,
      type: meta.type,
      typeLabel,
      agentPhase: meta.agentPhase,
      identity: meta.identity,
      config: meta.config,
      tools: meta.tools,
      agents,
      skills: meta.skills,
      outputs: meta.outputs,
      models: [...new Set(agents.map((a) => a.model).filter(Boolean))],
      runtimeAgentCount: agents.filter((a) => a.type === "runtime").length,
      harnessAgentCount: agents.filter((a) => a.type === "harness").length,
    };
  });
}

export const PIPELINE_PHASES: PipelinePhaseConfig[] = buildPipelinePhases();

// ─── Helper: Resolve tool name to icon ──────────────────────────────────────

/**
 * Given a tool name from a tool_use event, resolve which icon category it maps to.
 * Returns the icon key (for aws-icons.json) or "skill"/"ext" for dot indicators.
 */
export function resolveToolIcon(toolName: string): { icon: string; label: string } | null {
  // Direct match
  if (TOOL_ICON_MAP[toolName]) {
    return TOOL_ICON_MAP[toolName];
  }

  // Prefix match (e.g., "S3Storage___" prefix)
  for (const [key, value] of Object.entries(TOOL_ICON_MAP)) {
    if (toolName.startsWith(key.split("___")[0] + "___")) {
      return value;
    }
  }

  return null;
}

// ─── Helper: Find which phase an agent belongs to ───────────────────────────

export function findAgentPhase(agentId: string): PipelinePhaseConfig | undefined {
  return PIPELINE_PHASES.find((phase) =>
    phase.agents.some((a) => a.id === agentId)
  );
}

// ─── Helper: Get all agent IDs from config ──────────────────────────────────

export function getAllAgentIds(): string[] {
  return PIPELINE_PHASES.flatMap((phase) => phase.agents.map((a) => a.id));
}
