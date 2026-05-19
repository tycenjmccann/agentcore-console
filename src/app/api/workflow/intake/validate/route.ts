import { NextRequest, NextResponse } from "next/server";
import { validateIntakeSources } from "@/lib/workflow/intake";
import type { IntakeSource, RepoConfig } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/workflow/intake/validate
 *
 * Enhanced intake validation endpoint for the intake card.
 * Validates the full intake form before submission, providing
 * detailed feedback for each field.
 *
 * Request body:
 *   - title: string
 *   - description: string
 *   - sources: IntakeSource[]
 *   - repoConfig: RepoConfig
 *
 * Response:
 *   - valid: boolean
 *   - fields: Record<fieldName, { valid, errors, warnings }>
 *   - suggestions: string[] — AI-generated suggestions for improvement
 */

export interface ValidationResult {
  valid: boolean;
  fields: Record<string, FieldValidation>;
  suggestions: string[];
}

interface FieldValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, sources, repoConfig } = body as {
      title?: string;
      description?: string;
      sources?: IntakeSource[];
      repoConfig?: RepoConfig;
    };

    const fields: Record<string, FieldValidation> = {};
    const suggestions: string[] = [];

    // ─── Title Validation ──────────────────────────────────────────────────
    const titleValidation: FieldValidation = { valid: true, errors: [], warnings: [] };

    if (!title || title.trim().length === 0) {
      titleValidation.valid = false;
      titleValidation.errors.push("Title is required");
    } else if (title.trim().length < 5) {
      titleValidation.warnings.push("Title is very short — consider being more descriptive");
    } else if (title.trim().length > 200) {
      titleValidation.valid = false;
      titleValidation.errors.push("Title must be 200 characters or less");
    }

    fields.title = titleValidation;

    // ─── Description Validation ────────────────────────────────────────────
    const descValidation: FieldValidation = { valid: true, errors: [], warnings: [] };

    if (!description || description.trim().length === 0) {
      descValidation.warnings.push("A description helps agents understand the full context");
      suggestions.push("Add a description with user stories or acceptance criteria for better results");
    } else if (description.trim().length < 20) {
      descValidation.warnings.push("Description is brief — more detail produces better agent output");
      suggestions.push("Consider adding acceptance criteria or user stories");
    } else {
      // Check for common quality indicators
      const hasAcceptanceCriteria = /acceptance criteria|AC:|\[\s*[xX]?\s*\]/i.test(description);
      const hasUserStories = /as a .+, I want .+/i.test(description);
      const hasTechnicalContext = /api|endpoint|component|service|database|schema/i.test(description);

      if (!hasAcceptanceCriteria && !hasUserStories) {
        suggestions.push("Adding acceptance criteria or user stories helps agents produce more accurate output");
      }
      if (!hasTechnicalContext && description.length > 100) {
        suggestions.push("Consider mentioning specific technical components or APIs involved");
      }
    }

    fields.description = descValidation;

    // ─── Sources Validation ────────────────────────────────────────────────
    const sourcesValidation: FieldValidation = { valid: true, errors: [], warnings: [] };

    if (sources && sources.length > 0) {
      // Validate source URLs are reachable
      const sourceErrors = await validateIntakeSources(sources);
      if (sourceErrors.length > 0) {
        sourcesValidation.valid = false;
        sourcesValidation.errors = sourceErrors;
      }

      // Check for duplicate sources
      const seen = new Set<string>();
      for (const source of sources) {
        if (seen.has(source.value)) {
          sourcesValidation.warnings.push(`Duplicate source: ${source.value}`);
        }
        seen.add(source.value);
      }

      if (sources.length > 10) {
        sourcesValidation.warnings.push("Many sources provided — agents work best with focused, relevant references");
      }
    }

    fields.sources = sourcesValidation;

    // ─── Repo Config Validation ────────────────────────────────────────────
    const repoValidation: FieldValidation = { valid: true, errors: [], warnings: [] };

    if (!repoConfig) {
      repoValidation.warnings.push("No repository configured — agents won't create branches or PRs");
    } else if (repoConfig.repos && repoConfig.repos.length > 0) {
      for (const repo of repoConfig.repos) {
        if (!repo.url) {
          repoValidation.valid = false;
          repoValidation.errors.push("Repository URL is required");
        } else if (!repo.url.startsWith("https://") && !repo.url.startsWith("git@")) {
          repoValidation.warnings.push(`Repository URL format may be invalid: ${repo.url}`);
        }

        if (!repo.defaultBranch) {
          repoValidation.warnings.push("No default branch specified — will use 'main'");
        }
      }
    }

    fields.repoConfig = repoValidation;

    // ─── Overall Validity ──────────────────────────────────────────────────
    const valid = Object.values(fields).every((f) => f.valid);

    const result: ValidationResult = { valid, fields, suggestions };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[intake/validate] Error:", err);
    return NextResponse.json(
      { error: "Validation failed", details: (err as Error).message },
      { status: 500 }
    );
  }
}
