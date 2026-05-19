/**
 * Shared API types for the Workflow History Sidebar + Intake Card features.
 *
 * These types are consumed by both the API routes and frontend components.
 * Keep this file free of server-only imports so it can be safely imported
 * from client components.
 */

// ─── Workflow List API Types ─────────────────────────────────────────────────

/** Summary item returned by GET /api/workflow/list */
export interface WorkflowListItem {
  id: string;
  phase: string;
  epicId: string;
  input: {
    title: string;
    description: string;
  };
  startedAt: string;
  completedAt: string | null;
  agentTaskCount: number;
}

/** Pagination info returned by GET /api/workflow/list */
export interface PaginationInfo {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
}

/** Statistics returned by GET /api/workflow/list when includeStats=true */
export interface WorkflowStats {
  total: number;
  active: number;
  completed: number;
  error: number;
  filtered: number;
}

/** Full response from GET /api/workflow/list */
export interface WorkflowListResponse {
  workflows: WorkflowListItem[];
  pagination: PaginationInfo;
  stats?: WorkflowStats;
}

/** Query parameters for GET /api/workflow/list */
export interface WorkflowListParams {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: "active" | "completed" | "error" | "all";
  sort?: "startedAt" | "title" | "phase";
  order?: "asc" | "desc";
  includeStats?: boolean;
}

// ─── Workflow Summary API Types ──────────────────────────────────────────────

/** Phase progress info in workflow summary */
export interface PhaseProgressInfo {
  name: string;
  status: "pending" | "active" | "complete" | "error";
  agentCount: number;
  completedCount: number;
}

/** Response from GET /api/workflow/[id]/summary */
export interface WorkflowSummaryResponse {
  id: string;
  title: string;
  description: string;
  epicId: string;
  phase: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  progress: {
    completedAgents: number;
    totalAgents: number;
    percentage: number;
  };
  phases: PhaseProgressInfo[];
  ticketCount: number;
  featureBranch: string | null;
  hasErrors: boolean;
}

// ─── Workflow Templates API Types ────────────────────────────────────────────

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
  suggestedSources?: string[];
  skipAgents?: string[];
  modelId?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  defaults: TemplateDefaults;
  metadata: {
    createdAt: string;
    updatedAt: string;
    usageCount: number;
    isBuiltIn: boolean;
  };
}

export interface TemplateCategoryInfo {
  id: TemplateCategory;
  label: string;
  count: number;
}

/** Response from GET /api/workflow/templates */
export interface TemplatesResponse {
  templates: WorkflowTemplate[];
  categories: TemplateCategoryInfo[];
}

// ─── User Preferences API Types ──────────────────────────────────────────────

export interface SortPreference {
  field: "startedAt" | "title" | "phase";
  order: "asc" | "desc";
}

export interface WorkflowPreferences {
  userId: string;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  defaultTemplate: string | null;
  listViewMode: "compact" | "detailed";
  sortPreference: SortPreference;
  lastViewedWorkflowId: string | null;
  updatedAt: string;
}

// ─── Intake Validation API Types ─────────────────────────────────────────────

export interface FieldValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IntakeValidationResult {
  valid: boolean;
  fields: Record<string, FieldValidation>;
  suggestions: string[];
}

// ─── Duplicate Workflow API Types ────────────────────────────────────────────

export interface DuplicateWorkflowResponse {
  prefilled: {
    title: string;
    description: string;
    repoConfig: unknown;
    sources: unknown[];
    modelOverride?: unknown;
    duplicatedFrom: {
      workflowId: string;
      epicId: string;
      originalTitle: string;
      completedAt: string | null;
    };
  };
}
