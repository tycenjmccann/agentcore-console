import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

/**
 * User Preferences API for Workflow UI
 *
 * GET /api/workflow/preferences — Retrieve user preferences (sidebar state, etc.)
 * PUT /api/workflow/preferences — Update user preferences
 *
 * Supports persisting:
 *   - sidebarCollapsed: boolean — whether the history sidebar is collapsed
 *   - sidebarWidth: number — custom sidebar width
 *   - defaultTemplate: string — last-used or favorite template ID
 *   - listViewMode: "compact" | "detailed" — workflow list display mode
 *   - sortPreference: { field, order } — persistent sort for workflow list
 *   - lastViewedWorkflowId: string — resume to last viewed workflow
 */

const REGION = process.env.AWS_REGION || "us-east-1";
const PREFERENCES_TABLE = process.env.PREFERENCES_TABLE || "agentis-user-preferences";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

export interface WorkflowPreferences {
  userId: string;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  defaultTemplate: string | null;
  listViewMode: "compact" | "detailed";
  sortPreference: {
    field: "startedAt" | "title" | "phase";
    order: "asc" | "desc";
  };
  lastViewedWorkflowId: string | null;
  updatedAt: string;
}

const DEFAULT_PREFERENCES: Omit<WorkflowPreferences, "userId" | "updatedAt"> = {
  sidebarCollapsed: false,
  sidebarWidth: 288,
  defaultTemplate: null,
  listViewMode: "compact",
  sortPreference: {
    field: "startedAt",
    order: "desc",
  },
  lastViewedWorkflowId: null,
};

/**
 * Get user ID from request.
 * In production, this would come from auth (JWT/session).
 * For now, we use a header or default to "default-user".
 */
function getUserId(req: NextRequest): string {
  return req.headers.get("x-user-id") || "default-user";
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = getUserId(req);

  try {
    const result = await ddb.send(new GetCommand({
      TableName: PREFERENCES_TABLE,
      Key: { userId },
    }));

    if (result.Item) {
      return NextResponse.json(result.Item as WorkflowPreferences);
    }

    // Return defaults if no preferences saved yet
    const defaults: WorkflowPreferences = {
      userId,
      ...DEFAULT_PREFERENCES,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(defaults);
  } catch (err) {
    console.error("[preferences] GET error:", err);
    // Graceful fallback — return defaults even if DynamoDB fails
    const defaults: WorkflowPreferences = {
      userId,
      ...DEFAULT_PREFERENCES,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(defaults);
  }
}

// ─── PUT Handler ─────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const userId = getUserId(req);

  try {
    const body = await req.json();

    // Validate incoming fields against allowed preference keys
    const allowedFields = [
      "sidebarCollapsed",
      "sidebarWidth",
      "defaultTemplate",
      "listViewMode",
      "sortPreference",
      "lastViewedWorkflowId",
    ];

    const updates: Partial<WorkflowPreferences> = {};
    for (const field of allowedFields) {
      if (field in body) {
        // Type validation for specific fields
        if (field === "sidebarCollapsed" && typeof body[field] !== "boolean") continue;
        if (field === "sidebarWidth" && (typeof body[field] !== "number" || body[field] < 200 || body[field] > 600)) continue;
        if (field === "listViewMode" && !["compact", "detailed"].includes(body[field])) continue;
        if (field === "sortPreference") {
          const sp = body[field];
          if (!sp || !sp.field || !sp.order) continue;
          if (!["startedAt", "title", "phase"].includes(sp.field)) continue;
          if (!["asc", "desc"].includes(sp.order)) continue;
        }
        (updates as Record<string, unknown>)[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid preference fields provided" },
        { status: 400 }
      );
    }

    // Merge with existing preferences
    let existing: WorkflowPreferences;
    try {
      const result = await ddb.send(new GetCommand({
        TableName: PREFERENCES_TABLE,
        Key: { userId },
      }));
      existing = (result.Item as WorkflowPreferences) || {
        userId,
        ...DEFAULT_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      existing = {
        userId,
        ...DEFAULT_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
    }

    const merged: WorkflowPreferences = {
      ...existing,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({
      TableName: PREFERENCES_TABLE,
      Item: merged,
    }));

    return NextResponse.json(merged);
  } catch (err) {
    console.error("[preferences] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to save preferences", details: (err as Error).message },
      { status: 500 }
    );
  }
}
