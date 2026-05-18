/**
 * Pipeline Phase Configuration Data
 * Static definitions for each phase in the Architecture Pipeline visualization.
 */
import type { PipelinePhaseConfig } from "@/lib/workflow/pipeline-types";

export const PIPELINE_PHASES: PipelinePhaseConfig[] = [
  {
    id: "p1",
    phaseNumber: 1,
    name: "Intake",
    phaseType: "app",
    identity: {
      lines: ["Next.js 14 / App Router"],
      icons: [],
    },
    configDetails: [
      { key: "Host", value: "localhost:3000" },
      { key: "Storage", value: "S3 multipart upload" },
      { key: "Trigger", value: "EventBridge on epic create" },
    ],
    sections: [
      {
        label: "User Actions",
        items: [
          { id: "i-prd", label: "Upload PRD / Mockup / Figma", dot: "ext" },
          { id: "i-repo", label: "Set Target Git Repo", dot: "ext" },
          { id: "i-s3", label: "S3 Artifact Storage", icon: "s3" },
        ],
      },
      {
        label: "Trigger",
        items: [
          { id: "i-epic", label: "Jira Epic Created (EventBridge)", icon: "eventbridge" },
        ],
      },
    ],
  },
  {
    id: "p2",
    phaseNumber: 2,
    name: "Requirements",
    phaseType: "agent",
    identity: {
      lines: ["AgentCore Runtime", "Claude Opus 4 (via Bedrock)"],
      icons: ["agentcore", "bedrock"],
    },
    configDetails: [
      { key: "Model", value: "us.anthropic.claude-opus-4-0-v1" },
      { key: "Memory", value: "built-in (short-term context)" },
      { key: "Max turns", value: "50" },
      { key: "Timeout", value: "15 min" },
    ],
    sections: [
      {
        label: "Tools",
        items: [
          { id: "r-s3", label: "S3 Read & Write", icon: "s3" },
          { id: "r-memory", label: "Memory Read/Write", icon: "agentcore" },
          { id: "r-gateway", label: "Gateway (Figma, Browser)", dot: "ext" },
        ],
      },
      {
        label: "Agent",
        items: [
          { id: "r-agent", label: "Requirements Analyst", icon: "agentcore" },
        ],
      },
      {
        label: "Skills (loaded: requirements-analysis)",
        items: [
          { id: "r-parse", label: "PRD Parsing & Visual Analysis", dot: "skill" },
          { id: "r-criteria", label: "Acceptance Criteria Generation", dot: "skill" },
          { id: "r-decomp", label: "Vertical-Slice Ticket Decomposition", dot: "skill" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "r-s3write", label: "Write artifacts to S3", icon: "s3" },
          { id: "r-jira", label: "Gateway: report_completion (tickets)", icon: "agentcore" },
        ],
      },
    ],
  },
  {
    id: "p3",
    phaseNumber: 3,
    name: "Design",
    phaseType: "agent",
    identity: {
      lines: ["AgentCore Runtime (x7 parallel)", "Claude Opus 4 / Sonnet 4"],
      icons: ["agentcore", "bedrock"],
    },
    configDetails: [
      { key: "Dispatch", value: "parallel fan-out, 7 runtimes" },
      { key: "Memory", value: "built-in + shared namespace" },
      { key: "A2A", value: "cross-agent query enabled" },
    ],
    sections: [
      {
        label: "Tools (all agents)",
        items: [
          { id: "d-s3", label: "S3 Read & Write", icon: "s3" },
          { id: "d-memory", label: "Memory Read/Write", icon: "agentcore" },
          { id: "d-gateway", label: "Gateway (Jira, Slack)", dot: "ext" },
          { id: "d-a2a", label: "A2A (cross-agent query)", icon: "agentcore" },
        ],
      },
      {
        label: "Agents (parallel)",
        items: [
          { id: "d-ios", label: "iOS Designer", icon: "agentcore" },
          { id: "d-android", label: "Android Designer", icon: "agentcore" },
          { id: "d-backend", label: "Backend Designer", icon: "agentcore" },
          { id: "d-security", label: "Security Reviewer", icon: "agentcore" },
          { id: "d-legal", label: "Legal/Compliance", icon: "agentcore" },
          { id: "d-l10n", label: "Localization Designer", icon: "agentcore" },
          { id: "d-analytics", label: "Analytics Designer", icon: "agentcore" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "d-artifacts", label: "Design docs to S3", icon: "s3" },
          { id: "d-jira", label: "Gateway: save_design_doc", icon: "agentcore" },
        ],
      },
    ],
  },
  {
    id: "p4",
    phaseNumber: 4,
    name: "Development",
    phaseType: "agent",
    identity: {
      lines: ["AgentCore Runtime (x3 parallel)", "Claude Sonnet 4"],
      icons: ["agentcore", "bedrock"],
    },
    configDetails: [
      { key: "Dispatch", value: "parallel fan-out, 3 runtimes" },
      { key: "Code", value: "Code Interpreter sandbox" },
      { key: "Git", value: "feature branch commits" },
    ],
    sections: [
      {
        label: "Tools (all agents)",
        items: [
          { id: "dev-s3", label: "S3 Read & Write", icon: "s3" },
          { id: "dev-ci", label: "Code Interpreter", icon: "code-interpreter" },
          { id: "dev-git", label: "GitHub (branch, commit, PR)", dot: "ext" },
          { id: "dev-a2a", label: "A2A (ask designers)", icon: "agentcore" },
        ],
      },
      {
        label: "Agents (parallel)",
        items: [
          { id: "dev-frontend", label: "Frontend Developer", icon: "agentcore" },
          { id: "dev-backend", label: "Backend Developer", icon: "agentcore" },
          { id: "dev-api", label: "API Developer", icon: "agentcore" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "dev-branch", label: "Feature branch + commits", dot: "ext" },
          { id: "dev-pr", label: "Pull Request created", dot: "ext" },
        ],
      },
    ],
  },
  {
    id: "p5",
    phaseNumber: 5,
    name: "Review",
    phaseType: "agent",
    identity: {
      lines: ["AgentCore Runtime", "Claude Opus 4"],
      icons: ["agentcore", "bedrock"],
    },
    configDetails: [
      { key: "Model", value: "us.anthropic.claude-opus-4-0-v1" },
      { key: "Retries", value: "3 fix cycles max" },
      { key: "Escalation", value: "human review on failure" },
    ],
    sections: [
      {
        label: "Tools",
        items: [
          { id: "rev-s3", label: "S3 Read (design docs)", icon: "s3" },
          { id: "rev-git", label: "GitHub (PR review)", dot: "ext" },
          { id: "rev-ci", label: "Code Interpreter (tests)", icon: "code-interpreter" },
        ],
      },
      {
        label: "Agent",
        items: [
          { id: "rev-agent", label: "QA / Code Reviewer", icon: "agentcore" },
        ],
      },
      {
        label: "Output",
        items: [
          { id: "rev-approve", label: "PR Approved + Merge", dot: "ext" },
          { id: "rev-notify", label: "Human notification", icon: "agentcore" },
        ],
      },
    ],
  },
];
