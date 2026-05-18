/**
 * Pipeline Configuration
 *
 * This file maps deployed AgentCore harness agents to pipeline visualization phases.
 * Anyone deploying Agentis Hub configures their agents here — the pipeline visualization
 * reads this config to know which agents exist, what tools they have, and how to
 * display them.
 *
 * To customize for your environment:
 * 1. Deploy your AgentCore harness agents (follow the agent setup guide)
 * 2. Update PIPELINE_AGENTS below with your agent IDs and harness names
 * 3. Update TOOL_ICON_MAP if you add custom gateway tools
 * 4. The pipeline visualization will automatically reflect your config
 */

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

  // GitHub integration
  "GitHubIntegration___get_file": { icon: "ext", label: "GitHub Read" },
  "GitHubIntegration___list_files": { icon: "ext", label: "GitHub List" },
  "GitHubIntegration___commit_file": { icon: "ext", label: "GitHub Commit" },
  "GitHubIntegration___create_branch": { icon: "ext", label: "GitHub Branch" },
  "GitHubIntegration___create_pr": { icon: "ext", label: "GitHub PR" },
  "GitHubIntegration___search_code": { icon: "ext", label: "GitHub Search" },

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

// ─── Pipeline Phase Definitions ─────────────────────────────────────────────
// Defines which agents belong to each pipeline phase.

export type PipelinePhaseId = "intake" | "requirements" | "design" | "development" | "qa";

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

export interface PipelinePhaseConfig {
  id: PipelinePhaseId;
  name: string;
  num: number;
  /** "app" for non-agent phases (intake), "agent" for AgentCore phases */
  type: "app" | "agent";
  /** Agents deployed in this phase */
  agents: PipelineAgentConfig[];
  /** Skills loaded by agents in this phase */
  skills: string[];
  /** Output items produced by this phase */
  outputs: string[];
}

// ─── Default Pipeline Configuration ─────────────────────────────────────────
// This is the Agentis Hub default deployment. Customize for your environment.

export const PIPELINE_PHASES: PipelinePhaseConfig[] = [
  {
    id: "intake",
    name: "Intake",
    num: 1,
    type: "app",
    agents: [],
    skills: [],
    outputs: ["Jira Epic Created (EventBridge)"],
  },
  {
    id: "requirements",
    name: "Requirements",
    num: 2,
    type: "agent",
    agents: [
      {
        id: "team-requirements-analyst",
        displayName: "Requirements Analyst",
        harnessName: "team_requirements_analyst",
        tools: [
          "S3Storage___read_object",
          "S3Storage___write_object",
          "S3Storage___list_objects",
          "SkillLoader___load_skill",
          "WorkflowOutput___submit_ticket_plan",
          "browser",
        ],
      },
    ],
    skills: [
      "PRD Parsing & Visual Analysis",
      "Acceptance Criteria Generation",
      "Vertical-Slice Ticket Decomposition",
    ],
    outputs: ["Write artifacts to S3", "Gateway: report_completion (tickets)"],
  },
  {
    id: "design",
    name: "Design",
    num: 3,
    type: "agent",
    agents: [
      {
        id: "team-ios-designer",
        displayName: "iOS Architecture Designer",
        harnessName: "team_ios_designer",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "GitHubIntegration___get_file", "GitHubIntegration___search_code", "browser"],
      },
      {
        id: "team-backend-designer",
        displayName: "Backend Systems Designer",
        harnessName: "team_backend_designer",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "GitHubIntegration___get_file", "GitHubIntegration___search_code", "browser"],
      },
      {
        id: "team-android-designer",
        displayName: "Android Designer",
        harnessName: "team_android_designer",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "browser"],
      },
      {
        id: "team-security-reviewer",
        displayName: "Security Reviewer",
        harnessName: "team_security_reviewer",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "GitHubIntegration___search_code", "browser"],
      },
      {
        id: "team-analytics-designer",
        displayName: "Analytics Designer",
        harnessName: "team_analytics_designer",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "browser"],
      },
      {
        id: "team-localization",
        displayName: "Localization Planner",
        harnessName: "team_localization",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "browser"],
      },
      {
        id: "team-legal-compliance",
        displayName: "Privacy & Compliance",
        harnessName: "team_legal_compliance",
        tools: ["S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill", "browser"],
      },
    ],
    skills: [
      "ios-architecture",
      "android-architecture",
      "backend-systems",
      "privacy-compliance",
      "threat-modeling",
      "localization",
      "general-design",
    ],
    outputs: ["Design docs to S3", "Gateway: report_completion"],
  },
  {
    id: "development",
    name: "Development",
    num: 4,
    type: "agent",
    agents: [
      {
        id: "team-backend-dev",
        displayName: "Backend Developer",
        harnessName: "team_backend_dev",
        tools: [
          "S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill",
          "GitHubIntegration___list_files", "GitHubIntegration___get_file",
          "GitHubIntegration___commit_file", "GitHubIntegration___create_branch",
          "GitHubIntegration___create_pr", "code_interpreter",
        ],
      },
      {
        id: "team-frontend-dev",
        displayName: "Frontend Developer",
        harnessName: "team_frontend_dev",
        tools: [
          "S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill",
          "GitHubIntegration___list_files", "GitHubIntegration___get_file",
          "GitHubIntegration___commit_file", "GitHubIntegration___create_branch",
          "GitHubIntegration___create_pr", "code_interpreter",
        ],
      },
      {
        id: "team-api-dev",
        displayName: "API Developer",
        harnessName: "team_api_dev",
        tools: [
          "S3Storage___read_object", "S3Storage___write_object", "SkillLoader___load_skill",
          "GitHubIntegration___list_files", "GitHubIntegration___get_file",
          "GitHubIntegration___commit_file", "GitHubIntegration___create_branch",
          "GitHubIntegration___create_pr", "code_interpreter",
        ],
      },
    ],
    skills: [
      "node-typescript",
      "swift-development",
      "full-stack",
    ],
    outputs: ["Feature branch (shared)", "Pull Request created"],
  },
  {
    id: "qa",
    name: "QA & Ship",
    num: 5,
    type: "agent",
    agents: [
      {
        id: "team-qa-verifier",
        displayName: "QA Verifier",
        harnessName: "team_qa_verifier",
        tools: [
          "GitHubIntegration___get_file", "GitHubIntegration___list_files",
          "GitHubIntegration___commit_file", "code_interpreter",
        ],
      },
      {
        id: "team-ci-agent",
        displayName: "CI Validation Agent",
        harnessName: "team_ci_agent",
        tools: [
          "GitHubIntegration___get_file", "GitHubIntegration___list_files",
          "GitHubIntegration___commit_file", "code_interpreter",
        ],
      },
    ],
    skills: [
      "Visual Regression + Pixel Compare",
      "E2E Tests (Playwright)",
      "CI Failure Analysis + Auto-fix",
      "Retry Loop (A2A fix request, 3x)",
    ],
    outputs: ["Pull Request (auto-merge ready)", "Workflow Complete"],
  },
];

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
