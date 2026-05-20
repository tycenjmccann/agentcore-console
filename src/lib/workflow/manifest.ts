/**
 * Cumulative Workflow Manifest
 *
 * Manages a JSON manifest stored in S3 that accumulates artifact references
 * as each agent produces output. Every downstream agent gets the full manifest
 * so it can load any artifact it needs via the s3_read tool.
 *
 * Key insight: instead of inlining truncated content into agent prompts,
 * we give agents S3 keys and tell them to read artifacts themselves.
 */

import { writeArtifact, readArtifact } from "./workspace";
import { ARTIFACT_BUCKET } from "./agent-setup";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowManifest {
  workflowId: string;
  createdAt: string;
  updatedAt: string;
  phases: {
    intake: ManifestEntry[];
    requirements: ManifestEntry[];
    design: ManifestEntry[];
    development: ManifestEntry[];
    verification: ManifestEntry[];
  };
}

export interface ManifestEntry {
  id: string;
  type: "source" | "analysis" | "design-doc" | "visual-spec" | "code" | "report";
  format: "html" | "css" | "json" | "markdown" | "image" | "text";
  description: string;
  s3Key: string;
  sizeBytes?: number;
  addedBy: string;
  addedAt: string;
  critical?: boolean;
}

export type ManifestPhase = keyof WorkflowManifest["phases"];

// ─── Processed Source (mirrors intake.ts shape) ─────────────────────────────

interface ProcessedSource {
  type: string;
  originalValue: string;
  content: string;
  contentType: string;
  label?: string;
  s3Key?: string;
  isImage?: boolean;
  imageFormat?: string;
  isBinary?: boolean;
}

// ─── Manifest CRUD ──────────────────────────────────────────────────────────

const MANIFEST_FILENAME = "manifest.json";

/**
 * Initialize the manifest when a workflow starts (after intake sources are processed).
 * Registers all intake sources as the initial entries.
 */
export async function initManifest(
  workflowId: string,
  intakeSources: ProcessedSource[]
): Promise<WorkflowManifest> {
  const now = new Date().toISOString();

  const intakeEntries: ManifestEntry[] = intakeSources
    .filter((src) => src.s3Key) // Only include sources that were stored in S3
    .map((src, index) => {
      const format = inferFormat(src);
      const isVisual = src.isImage || src.contentType?.includes("html");

      return {
        id: `intake-${index}-${Date.now().toString(36)}`,
        type: inferType(src) as ManifestEntry["type"],
        format,
        description: buildSourceDescription(src),
        s3Key: src.s3Key!,
        sizeBytes: src.content?.length,
        addedBy: "intake-processor",
        addedAt: now,
        critical: isVisual || src.contentType?.includes("html") || false,
      };
    });

  const manifest: WorkflowManifest = {
    workflowId,
    createdAt: now,
    updatedAt: now,
    phases: {
      intake: intakeEntries,
      requirements: [],
      design: [],
      development: [],
      verification: [],
    },
  };

  await persistManifest(workflowId, manifest);
  return manifest;
}

/**
 * Add entries to the manifest after an agent completes.
 */
export async function addManifestEntries(
  workflowId: string,
  phase: string,
  entries: Omit<ManifestEntry, "id" | "addedAt">[]
): Promise<void> {
  const manifest = await getManifest(workflowId);
  if (!manifest) {
    console.warn(`[manifest] Cannot add entries — manifest not found for ${workflowId}`);
    return;
  }

  const phaseKey = normalizePhase(phase);
  const now = new Date().toISOString();

  const newEntries: ManifestEntry[] = entries.map((entry, index) => ({
    ...entry,
    id: `${phaseKey}-${Date.now().toString(36)}-${index}`,
    addedAt: now,
  }));

  manifest.phases[phaseKey].push(...newEntries);
  manifest.updatedAt = now;

  await persistManifest(workflowId, manifest);
}

/**
 * Read the current manifest from S3.
 */
export async function getManifest(workflowId: string): Promise<WorkflowManifest | null> {
  try {
    const content = await readArtifact({
      workflowId,
      filename: MANIFEST_FILENAME,
      shared: true,
    });
    if (!content) return null;
    return JSON.parse(content) as WorkflowManifest;
  } catch {
    return null;
  }
}

// ─── Context Builder ────────────────────────────────────────────────────────

/**
 * Build the "manifest context" string that gets injected into every agent's prompt.
 * For critical items: INLINE the actual content from S3 (agents can't access S3 directly).
 * For non-critical items: just list the S3 URI for reference.
 *
 * Budget: up to 60K chars of critical inlined content (fits in context with room for code).
 */
export async function buildManifestContext(manifest: WorkflowManifest, agentPhase: string, agentId?: string): Promise<string> {
  const bucket = ARTIFACT_BUCKET;
  let ctx = `## Upstream Artifacts (from earlier pipeline phases)\n\n`;

  // Inline critical content for agents that need it.
  // Requirements agents need full intake content (they're analyzing it first).
  // Dev agents need full content for implementation. Design agents get less.
  const isDev = agentId?.includes("-dev") || agentId?.includes("-frontend") || agentPhase === "development";
  const isRequirements = agentPhase === "requirements" || agentId?.includes("requirements");
  const MAX_CRITICAL_BUDGET = (isDev || isRequirements) ? 60000 : 8000;
  let criticalBudgetUsed = 0;

  // Determine which phases to show (everything up to and including current phase)
  const phaseOrder: ManifestPhase[] = ["intake", "requirements", "design", "development", "verification"];
  const currentPhaseIndex = phaseOrder.indexOf(normalizePhase(agentPhase));

  for (const phase of phaseOrder) {
    const phaseIndex = phaseOrder.indexOf(phase);
    if (phaseIndex > currentPhaseIndex) break;

    const entries = manifest.phases[phase];
    if (entries.length === 0) continue;

    ctx += `### ${capitalize(phase)} Phase\n`;

    for (const entry of entries) {
      // Requirements agents get ALL text content inlined (they need full intake to analyze).
      // Other agents only get entries marked critical.
      const shouldInline = (entry.format !== "image") && criticalBudgetUsed < MAX_CRITICAL_BUDGET &&
        (entry.critical || isRequirements);
      if (shouldInline) {
        // INLINE content directly — agents can't access S3
        try {
          // Parse the s3Key which may be a full URI or just a key path
          const rawKey = entry.s3Key.replace(/^s3:\/\/[^/]+\//, "");
          const filename = rawKey.split("/").pop() || "";
          const isIntake = rawKey.includes("/intake/");
          const content = await readArtifact({
            workflowId: manifest.workflowId,
            filename,
            agentId: isIntake ? "intake" : "shared",
            shared: !isIntake,
          });
          if (content) {
            const budget = MAX_CRITICAL_BUDGET - criticalBudgetUsed;
            const trimmed = content.length > budget ? content.slice(0, budget) + "\n[...TRUNCATED]" : content;
            ctx += `#### [CRITICAL] ${entry.description}\n`;
            ctx += `\`\`\`\n${trimmed}\n\`\`\`\n\n`;
            criticalBudgetUsed += trimmed.length;
            continue;
          }
        } catch { /* fallback to URI listing */ }
      }

      // Non-critical or couldn't read: just list the URI
      const sizeStr = entry.sizeBytes ? ` (${formatSize(entry.sizeBytes)})` : "";
      const tag = entry.critical ? "[CRITICAL — could not inline] " : "";
      ctx += `- ${tag}${entry.description}${sizeStr}: s3://${bucket}/${entry.s3Key}\n`;
    }
    ctx += `\n`;
  }

  if (criticalBudgetUsed > 0) {
    ctx += `---\n`;
    ctx += `The content above is your PRIMARY implementation reference. Match the CSS values, colors, dimensions, and animations EXACTLY.\n\n`;
  }

  return ctx;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

async function persistManifest(workflowId: string, manifest: WorkflowManifest): Promise<void> {
  await writeArtifact({
    workflowId,
    agentId: "manifest",
    filename: MANIFEST_FILENAME,
    content: JSON.stringify(manifest, null, 2),
    contentType: "application/json",
    shared: true,
  });
}

function normalizePhase(phase: string): ManifestPhase {
  const mapping: Record<string, ManifestPhase> = {
    intake: "intake",
    requirements: "requirements",
    design: "design",
    development: "development",
    verification: "verification",
    // Agent-level phases map to broader categories
    "team-requirements-analyst": "requirements",
    "team-frontend-designer": "design",
    "team-ios-designer": "design",
    "team-backend-designer": "design",
    "team-android-designer": "design",
    "team-security-reviewer": "design",
    "team-frontend-dev": "development",
    "team-backend-dev": "development",
    "team-api-dev": "development",
    "team-qa-engineer": "verification",
  };
  return mapping[phase] || "development";
}

function inferFormat(src: ProcessedSource): ManifestEntry["format"] {
  if (src.isImage) return "image";
  if (src.contentType?.includes("html")) return "html";
  if (src.contentType?.includes("css")) return "css";
  if (src.contentType?.includes("json")) return "json";
  if (src.contentType?.includes("markdown")) return "markdown";
  return "text";
}

function inferType(src: ProcessedSource): string {
  if (src.isImage) return "visual-spec";
  if (src.contentType?.includes("html")) return "source";
  if (src.contentType?.includes("css")) return "source";
  return "source";
}

function buildSourceDescription(src: ProcessedSource): string {
  if (src.label) return src.label;
  if (src.isImage) return `Screenshot/mockup (${src.imageFormat || "image"})`;
  if (src.contentType?.includes("html")) return `Target HTML mockup`;
  if (src.contentType?.includes("css")) return `CSS stylesheet`;
  if (src.contentType?.includes("json")) return `JSON data`;
  if (src.contentType?.includes("markdown")) return `Documentation (markdown)`;
  return `Source content (${src.type}: ${src.originalValue.slice(0, 60)})`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
