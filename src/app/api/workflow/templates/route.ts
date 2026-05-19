import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Workflow Templates API
 *
 * GET /api/workflow/templates — Returns available workflow templates
 *   for the enhanced intake card. Templates provide pre-filled configurations
 *   to speed up common workflow patterns.
 *
 * POST /api/workflow/templates — Create a custom template (future)
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  /** Pre-filled intake fields */
  defaults: TemplateDefaults;
  /** Template metadata */
  metadata: {
    createdAt: string;
    updatedAt: string;
    usageCount: number;
    isBuiltIn: boolean;
  };
}

export type TemplateCategory =
  | "feature"
  | "bugfix"
  | "refactor"
  | "infrastructure"
  | "documentation"
  | "custom";

export interface TemplateDefaults {
  title?: string;
  description?: string;
  repoLayout?: "monorepo" | "multi-repo";
  /** Suggested input sources */
  suggestedSources?: string[];
  /** Which agents to auto-skip */
  skipAgents?: string[];
  /** Pre-selected model */
  modelId?: string;
}

// ─── Built-in Templates ──────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "tmpl-new-feature",
    name: "New Feature",
    description: "Full-stack feature development with design, implementation, and QA.",
    category: "feature",
    icon: "sparkles",
    defaults: {
      description: "## Feature Description\n\n[Describe the feature]\n\n## User Stories\n\n- As a [user type], I want [goal] so that [benefit]\n\n## Acceptance Criteria\n\n- [ ] \n",
      repoLayout: "monorepo",
    },
    metadata: {
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      usageCount: 0,
      isBuiltIn: true,
    },
  },
  {
    id: "tmpl-bug-fix",
    name: "Bug Fix",
    description: "Targeted bug fix with reproduction steps and regression testing.",
    category: "bugfix",
    icon: "bug",
    defaults: {
      description: "## Bug Description\n\n[What is the bug?]\n\n## Steps to Reproduce\n\n1. \n2. \n3. \n\n## Expected Behavior\n\n[What should happen]\n\n## Actual Behavior\n\n[What actually happens]\n\n## Environment\n\n- Browser/Device: \n- Version: \n",
      repoLayout: "monorepo",
      skipAgents: ["team-ios-designer", "team-android-designer", "team-analytics-designer"],
    },
    metadata: {
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      usageCount: 0,
      isBuiltIn: true,
    },
  },
  {
    id: "tmpl-api-endpoint",
    name: "API Endpoint",
    description: "New API endpoint with OpenAPI spec, validation, and integration tests.",
    category: "feature",
    icon: "server",
    defaults: {
      description: "## API Endpoint\n\n**Method**: [GET/POST/PUT/DELETE]\n**Path**: /api/\n\n## Request\n\n```json\n{}\n```\n\n## Response\n\n```json\n{}\n```\n\n## Authentication\n\n[Required auth type]\n\n## Notes\n\n",
      repoLayout: "monorepo",
      skipAgents: ["team-ios-designer", "team-android-designer"],
    },
    metadata: {
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      usageCount: 0,
      isBuiltIn: true,
    },
  },
  {
    id: "tmpl-ui-component",
    name: "UI Component",
    description: "New UI component with design specs, accessibility, and storybook integration.",
    category: "feature",
    icon: "layout",
    defaults: {
      description: "## Component Name\n\n[ComponentName]\n\n## Design\n\n[Link to Figma/mockup or describe the visual design]\n\n## Props\n\n| Prop | Type | Default | Description |\n|------|------|---------|-------------|\n| | | | |\n\n## Variants\n\n- Default\n- \n\n## Accessibility\n\n- ARIA labels: \n- Keyboard navigation: \n",
      repoLayout: "monorepo",
      skipAgents: ["team-backend-dev", "team-backend-designer"],
    },
    metadata: {
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      usageCount: 0,
      isBuiltIn: true,
    },
  },
  {
    id: "tmpl-refactor",
    name: "Code Refactor",
    description: "Refactoring task with clear scope boundaries and regression safety.",
    category: "refactor",
    icon: "refresh-cw",
    defaults: {
      description: "## Refactoring Scope\n\n[What code needs refactoring]\n\n## Current Issues\n\n- \n\n## Desired Outcome\n\n- \n\n## Constraints\n\n- No public API changes\n- All existing tests must pass\n- \n\n## Files Affected\n\n- \n",
      repoLayout: "monorepo",
      skipAgents: ["team-ios-designer", "team-android-designer", "team-analytics-designer", "team-localization"],
    },
    metadata: {
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      usageCount: 0,
      isBuiltIn: true,
    },
  },
  {
    id: "tmpl-infrastructure",
    name: "Infrastructure Change",
    description: "Infrastructure or DevOps change with deployment plan and rollback strategy.",
    category: "infrastructure",
    icon: "cloud",
    defaults: {
      description: "## Infrastructure Change\n\n[What infrastructure needs to change]\n\n## Current State\n\n[Describe current setup]\n\n## Desired State\n\n[Describe target setup]\n\n## Deployment Plan\n\n1. \n\n## Rollback Strategy\n\n[How to revert if something goes wrong]\n\n## Monitoring\n\n[What to watch after deployment]\n",
      repoLayout: "monorepo",
      skipAgents: ["team-ios-designer", "team-android-designer", "team-frontend-dev"],
    },
    metadata: {
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      usageCount: 0,
      isBuiltIn: true,
    },
  },
];

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || null;

  let templates = [...BUILT_IN_TEMPLATES];

  // Filter by category if specified
  if (category && category !== "all") {
    templates = templates.filter((t) => t.category === category);
  }

  // Available categories for UI filtering
  const categories: { id: TemplateCategory; label: string; count: number }[] = [
    { id: "feature", label: "Feature", count: BUILT_IN_TEMPLATES.filter((t) => t.category === "feature").length },
    { id: "bugfix", label: "Bug Fix", count: BUILT_IN_TEMPLATES.filter((t) => t.category === "bugfix").length },
    { id: "refactor", label: "Refactor", count: BUILT_IN_TEMPLATES.filter((t) => t.category === "refactor").length },
    { id: "infrastructure", label: "Infrastructure", count: BUILT_IN_TEMPLATES.filter((t) => t.category === "infrastructure").length },
    { id: "documentation", label: "Documentation", count: BUILT_IN_TEMPLATES.filter((t) => t.category === "documentation").length },
    { id: "custom", label: "Custom", count: BUILT_IN_TEMPLATES.filter((t) => t.category === "custom").length },
  ];

  return NextResponse.json({
    templates,
    categories,
  });
}
