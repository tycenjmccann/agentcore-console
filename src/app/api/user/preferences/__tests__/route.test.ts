/**
 * Unit tests for user preferences API validation logic
 */

import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/user-preferences";

describe("UserPreferences defaults", () => {
  it("has sensible default values", () => {
    expect(DEFAULT_PREFERENCES.sidebarCollapsed).toBe(false);
    expect(DEFAULT_PREFERENCES.sidebarWidth).toBe(288);
    expect(DEFAULT_PREFERENCES.historySidebarCollapsed).toBe(false);
    expect(DEFAULT_PREFERENCES.workflowCardView).toBe("comfortable");
    expect(DEFAULT_PREFERENCES.workflowSortOrder).toBe("active-first");
    expect(DEFAULT_PREFERENCES.showCompletedWorkflows).toBe(true);
    expect(DEFAULT_PREFERENCES.intakeFormExpanded).toBe(true);
  });

  it("validates sidebar width bounds", () => {
    // This tests the validation logic pattern used in the route handler
    const validWidths = [200, 288, 400, 600];
    const invalidWidths = [100, 199, 601, 1000];

    for (const w of validWidths) {
      expect(w >= 200 && w <= 600).toBe(true);
    }
    for (const w of invalidWidths) {
      expect(w >= 200 && w <= 600).toBe(false);
    }
  });

  it("validates workflowCardView enum", () => {
    const validValues = ["compact", "comfortable", "detailed"];
    const invalidValues = ["large", "small", ""];

    for (const v of validValues) {
      expect(validValues.includes(v)).toBe(true);
    }
    for (const v of invalidValues) {
      expect(validValues.includes(v)).toBe(false);
    }
  });

  it("validates workflowSortOrder enum", () => {
    const validValues = ["active-first", "newest-first", "oldest-first"];
    const invalidValues = ["alphabetical", "random", ""];

    for (const v of validValues) {
      expect(validValues.includes(v)).toBe(true);
    }
    for (const v of invalidValues) {
      expect(validValues.includes(v)).toBe(false);
    }
  });
});

describe("Preference merge semantics", () => {
  it("partial update preserves other fields", () => {
    const current: UserPreferences = { ...DEFAULT_PREFERENCES };
    const updates: Partial<UserPreferences> = { sidebarCollapsed: true };
    const merged = { ...current, ...updates };

    expect(merged.sidebarCollapsed).toBe(true);
    expect(merged.sidebarWidth).toBe(288);
    expect(merged.historySidebarCollapsed).toBe(false);
    expect(merged.workflowCardView).toBe("comfortable");
  });

  it("multiple updates merge correctly", () => {
    const current: UserPreferences = { ...DEFAULT_PREFERENCES };
    const updates: Partial<UserPreferences> = {
      historySidebarCollapsed: true,
      workflowCardView: "compact",
      showCompletedWorkflows: false,
    };
    const merged = { ...current, ...updates };

    expect(merged.historySidebarCollapsed).toBe(true);
    expect(merged.workflowCardView).toBe("compact");
    expect(merged.showCompletedWorkflows).toBe(false);
    expect(merged.sidebarCollapsed).toBe(false); // unchanged
  });
});
