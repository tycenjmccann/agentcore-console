/**
 * User Preferences Storage
 *
 * Manages user UI preferences with DynamoDB persistence.
 * Provides type-safe defaults and merge semantics for partial updates.
 *
 * Table: agentis-user-preferences (configurable via env)
 * Key: userId (defaults to "default" for single-user setup)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const PREFERENCES_TABLE =
  process.env.USER_PREFERENCES_TABLE || "agentis-user-preferences";
const DEFAULT_USER_ID = "default";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserPreferences {
  /** Whether the main navigation sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Sidebar width in pixels (when expanded) */
  sidebarWidth: number;
  /** Whether the workflow history sidebar (on workflow page) is collapsed */
  historySidebarCollapsed: boolean;
  /** Workflow card display density */
  workflowCardView: "compact" | "comfortable" | "detailed";
  /** Sort order for workflow list */
  workflowSortOrder: "active-first" | "newest-first" | "oldest-first";
  /** Whether to show completed workflows in the sidebar */
  showCompletedWorkflows: boolean;
  /** Whether the intake form section is expanded by default */
  intakeFormExpanded: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsed: false,
  sidebarWidth: 288, // w-72 = 18rem = 288px
  historySidebarCollapsed: false,
  workflowCardView: "comfortable",
  workflowSortOrder: "active-first",
  showCompletedWorkflows: true,
  intakeFormExpanded: true,
};

// ─── In-memory cache (reduces DynamoDB reads) ────────────────────────────────

let cachedPreferences: UserPreferences | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get user preferences. Returns cached value if fresh, otherwise reads from DynamoDB.
 * Falls back to defaults if DynamoDB is unreachable.
 */
export async function getUserPreferences(
  userId: string = DEFAULT_USER_ID
): Promise<UserPreferences> {
  // Check cache
  if (cachedPreferences && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPreferences;
  }

  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: PREFERENCES_TABLE,
        Key: { userId },
      })
    );

    if (result.Item) {
      const stored = result.Item as any;
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        ...stripDynamoMeta(stored),
      };
      cachedPreferences = prefs;
      cacheTimestamp = Date.now();
      return prefs;
    }
  } catch (err) {
    console.warn(
      "[user-preferences] DynamoDB read failed, using defaults:",
      (err as Error).message
    );
  }

  // Return defaults if no stored prefs or error
  cachedPreferences = { ...DEFAULT_PREFERENCES };
  cacheTimestamp = Date.now();
  return cachedPreferences;
}

/**
 * Update user preferences (partial merge). Persists to DynamoDB and updates cache.
 */
export async function setUserPreferences(
  updates: Partial<UserPreferences>,
  userId: string = DEFAULT_USER_ID
): Promise<UserPreferences> {
  // Get current preferences
  const current = await getUserPreferences(userId);

  // Merge updates
  const merged: UserPreferences = { ...current, ...updates };

  try {
    await ddb.send(
      new PutCommand({
        TableName: PREFERENCES_TABLE,
        Item: {
          userId,
          ...merged,
          updatedAt: new Date().toISOString(),
        },
      })
    );

    // Update cache
    cachedPreferences = merged;
    cacheTimestamp = Date.now();
  } catch (err) {
    console.error(
      "[user-preferences] DynamoDB write failed:",
      (err as Error).message
    );
    // Still update in-memory cache so the UI stays consistent within this session
    cachedPreferences = merged;
    cacheTimestamp = Date.now();
  }

  return merged;
}

/**
 * Reset preferences to defaults.
 */
export async function resetUserPreferences(
  userId: string = DEFAULT_USER_ID
): Promise<UserPreferences> {
  return setUserPreferences(DEFAULT_PREFERENCES, userId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip DynamoDB metadata fields from stored item */
function stripDynamoMeta(item: Record<string, any>): Record<string, any> {
  const { userId, updatedAt, ...rest } = item;
  return rest;
}
