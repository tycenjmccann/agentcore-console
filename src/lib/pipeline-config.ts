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

  // Skill loader
  "SkillLoader___load_skill": { icon: "skill", label: "Load Skill" },

  // GitHub integration (via hosted MCP)
  "get_file_contents": { icon: "ext", label: "GitHub Read" },
  "create_or_update_file": { icon: "ext", label: "GitHub Commit" },
  "create_branch": { icon: "ext", label: "GitHub Branch" },
  "create_pull_request": { icon: "ext", label: "GitHub PR" },
  "search_code": { icon: "ext", label: "GitHub Search" },
  "push_files": { icon: "ext", label: "GitHub Push" },
  "list_commits": { icon: "ext", label: "GitHub Commits" },

  // Workflow output
  "WorkflowOutput___submit_ticket_plan": { icon: "agentcore", label: "Submit Plan" },
  "WorkflowOutput___report_completion": { icon: "agentcore", label: "Report Complete" },
  "WorkflowOutput___save_design_doc": { icon: "agentcore", label: "Save Design" },

  // Jira
  "JiraIntegration___add_comment": { icon: "ext", label: "Jira Comment" },

  // Code interpreter (built-in harness tool)
  "code_interpreter": { icon: "codebuild", label: "Code Interpreter" },

  // Browser (built-in harness tool)
  "browser": { icon: "ext", label: "Browser" },

  // A2A invoke
  "invoke_team_agent": { icon: "agentcore", label: "A2A Invoke" },
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
      { key: "Memory", val: "built-in (short-term context)" },
      { key: "Max turns", val: "50" },
      { key: "Timeout", val: "15 min" },
    ],
    tools: [
      { icon: "s3", label: "S3 Read & Write" },
      { icon: "agentcore", label: "Memory Read/Write" },
      { dot: "ext", label: "Gateway (Figma, Browser)" },
    ],
    skills: [
      "PRD Parsing & Visual Analysis",
      "Acceptance Criteria Generation",
      "Vertical-Slice Ticket Decomposition",
    ],
    outputs: [
      { icon: "s3", label: "Write artifacts to S3" },
      { icon: "agentcore", label: "Gateway: report_completion (tickets)" },
    ],
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
      { key: "Memory", val: "built-in + shared namespace" },
      { key: "A2A", val: "cross-agent query enabled" },
    ],
    tools: [
      { icon: "s3", label: "S3 Read & Write" },
      { icon: "agentcore", label: "Memory + A2A" },
      { dot: "ext", label: "Gateway (Jira, GitHub)" },
    ],
    skills: [
      "Frontend/Web UI Design",
      "iOS Architecture Design",
      "Backend Systems Design",
      "Privacy & Compliance",
      "Security Review",
    ],
    outputs: [
      { icon: "s3", label: "Design docs to S3" },
      { icon: "agentcore", label: "Gateway: save_design_doc" },
    ],
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
      { key: "Tools", val: "Git CLI + Code Interpreter" },
      { key: "Branch", val: "feature/{ticket}-{role}" },
    ],
    tools: [
      { icon: "s3", label: "S3 Read & Write" },
      { icon: "codebuild", label: "Code Interpreter" },
      { dot: "ext", label: "Git CLI (clone, commit, push)" },
      { icon: "agentcore", label: "Memory + A2A + Gateway" },
    ],
    skills: [
      "Swift / iOS Development",
      "Node.js / TypeScript",
      "Full-Stack Integration",
    ],
    outputs: [
      { dot: "ext", label: "Git commits to feature branch" },
      { icon: "agentcore", label: "Gateway: report_completion (PR)" },
    ],
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
      { key: "Tools", val: "Git + Code Interpreter + A2A" },
    ],
    tools: [
      { dot: "ext", label: "Git CLI (read feature branch)" },
      { icon: "codebuild", label: "Code Interpreter (tests)" },
      { icon: "agentcore", label: "Memory + A2A + Gateway" },
    ],
    skills: [
      "Visual Regression + Pixel Compare",
      "E2E Tests (Playwright)",
      "CI Failure Analysis + Auto-fix",
      "Retry Loop (A2A fix request, 3x)",
    ],
    outputs: [
      { dot: "ext", label: "Pull Request (auto-merge ready)" },
      { icon: "agentcore", label: "Workflow Complete" },
    ],
  },
};

// ─── Agent Config Interface ─────────────────────────────────────────────────

export interface PipelineAgentConfig {
  /** Agent ID — must match AGENT_ROSTER id and WorkflowState.agentTasks keys */
  id: string;
  /** Display name shown in pipeline */
  displayName: string;
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
        harnessName: a.harnessName,
        tools: a.tools.filter((t) => t !== "gateway" && t !== "invoke_team_agent" && t !== "browser"),
      }));

    // Generate typeLabel dynamically
    let typeLabel: string;
    if (meta.type === "app") {
      typeLabel = "Web Application";
    } else {
      const count = agents.length;
      typeLabel = `${count} AgentCore Harness Agent${count !== 1 ? "s" : ""}`;
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
