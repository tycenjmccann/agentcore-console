/**
 * GET/PUT /api/user/preferences
 *
 * Persists user UI preferences (sidebar collapse state, layout settings, etc.)
 * Uses DynamoDB for storage. Falls back to defaults if DynamoDB is unavailable.
 *
 * Preferences are keyed by a user identifier. In the current single-user setup,
 * we use a fixed key. This can be extended to use auth tokens in the future.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getUserPreferences,
  setUserPreferences,
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "@/lib/user-preferences";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/preferences
 * Returns the current user's UI preferences.
 */
export async function GET() {
  try {
    const prefs = await getUserPreferences();
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    console.error("[user/preferences] GET error:", err);
    // Return defaults on error — UI should still work
    return NextResponse.json({ preferences: DEFAULT_PREFERENCES });
  }
}

/**
 * PUT /api/user/preferences
 * Updates (merges) user preferences. Partial updates are supported.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the incoming preferences shape
    const updates: Partial<UserPreferences> = {};

    if (typeof body.sidebarCollapsed === "boolean") {
      updates.sidebarCollapsed = body.sidebarCollapsed;
    }
    if (typeof body.sidebarWidth === "number" && body.sidebarWidth >= 200 && body.sidebarWidth <= 600) {
      updates.sidebarWidth = body.sidebarWidth;
    }
    if (typeof body.historySidebarCollapsed === "boolean") {
      updates.historySidebarCollapsed = body.historySidebarCollapsed;
    }
    if (["compact", "comfortable", "detailed"].includes(body.workflowCardView)) {
      updates.workflowCardView = body.workflowCardView;
    }
    if (["active-first", "newest-first", "oldest-first"].includes(body.workflowSortOrder)) {
      updates.workflowSortOrder = body.workflowSortOrder;
    }
    if (typeof body.showCompletedWorkflows === "boolean") {
      updates.showCompletedWorkflows = body.showCompletedWorkflows;
    }
    if (typeof body.intakeFormExpanded === "boolean") {
      updates.intakeFormExpanded = body.intakeFormExpanded;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid preference fields provided" },
        { status: 400 }
      );
    }

    const updatedPrefs = await setUserPreferences(updates);
    return NextResponse.json({ preferences: updatedPrefs });
  } catch (err) {
    console.error("[user/preferences] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
