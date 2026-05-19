/**
 * React hook for user workflow preferences.
 *
 * Manages the sidebar collapse state and other user preferences
 * with optimistic local updates and background sync to the server.
 *
 * Features:
 *   - Immediate local state updates (no lag)
 *   - Background persistence to API
 *   - Fallback to localStorage if API unavailable
 *   - Debounced saves to reduce API calls
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { WorkflowPreferences, SortPreference } from "@/lib/workflow/api-types";

const LOCAL_STORAGE_KEY = "workflow-preferences";
const DEBOUNCE_MS = 1000;

const DEFAULT_PREFERENCES: Omit<WorkflowPreferences, "userId" | "updatedAt"> = {
  sidebarCollapsed: false,
  sidebarWidth: 288,
  defaultTemplate: null,
  listViewMode: "compact",
  sortPreference: { field: "startedAt", order: "desc" },
  lastViewedWorkflowId: null,
};

interface UsePreferencesReturn {
  preferences: WorkflowPreferences;
  isLoading: boolean;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state directly */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Set sidebar width */
  setSidebarWidth: (width: number) => void;
  /** Set list view mode */
  setListViewMode: (mode: "compact" | "detailed") => void;
  /** Set sort preference */
  setSortPreference: (sort: SortPreference) => void;
  /** Set last viewed workflow ID */
  setLastViewedWorkflowId: (id: string | null) => void;
  /** Set default template */
  setDefaultTemplate: (templateId: string | null) => void;
}

export function useWorkflowPreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<WorkflowPreferences>({
    userId: "default-user",
    ...DEFAULT_PREFERENCES,
    updatedAt: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<WorkflowPreferences>>({});

  // Load preferences from API (with localStorage fallback)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Try localStorage first for instant load
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setPreferences((prev) => ({ ...prev, ...parsed }));
          } catch { /* ignore parse errors */ }
        }

        // Then fetch from API for authoritative state
        const res = await fetch("/api/workflow/preferences");
        if (res.ok) {
          const data = await res.json();
          setPreferences(data);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        }
      } catch {
        // API unavailable — use local/defaults
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Persist to API (debounced)
  const persistToApi = useCallback(async (updates: Partial<WorkflowPreferences>) => {
    try {
      await fetch("/api/workflow/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {
      // Silent fail — localStorage is the fallback
    }
  }, []);

  // Update a preference field with optimistic local update + debounced API save
  const updatePreference = useCallback(
    (updates: Partial<WorkflowPreferences>) => {
      // Optimistic local update
      setPreferences((prev) => {
        const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      // Accumulate pending updates
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

      // Debounce API call
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const pending = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {};
        persistToApi(pending);
      }, DEBOUNCE_MS);
    },
    [persistToApi]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        // Flush any pending updates
        if (Object.keys(pendingUpdatesRef.current).length > 0) {
          persistToApi(pendingUpdatesRef.current);
        }
      }
    };
  }, [persistToApi]);

  // Convenience methods
  const toggleSidebar = useCallback(() => {
    setPreferences((prev) => {
      const collapsed = !prev.sidebarCollapsed;
      updatePreference({ sidebarCollapsed: collapsed });
      return { ...prev, sidebarCollapsed: collapsed };
    });
  }, [updatePreference]);

  const setSidebarCollapsed = useCallback(
    (collapsed: boolean) => updatePreference({ sidebarCollapsed: collapsed }),
    [updatePreference]
  );

  const setSidebarWidth = useCallback(
    (width: number) => updatePreference({ sidebarWidth: Math.min(Math.max(width, 200), 600) }),
    [updatePreference]
  );

  const setListViewMode = useCallback(
    (mode: "compact" | "detailed") => updatePreference({ listViewMode: mode }),
    [updatePreference]
  );

  const setSortPreference = useCallback(
    (sort: SortPreference) => updatePreference({ sortPreference: sort }),
    [updatePreference]
  );

  const setLastViewedWorkflowId = useCallback(
    (id: string | null) => updatePreference({ lastViewedWorkflowId: id }),
    [updatePreference]
  );

  const setDefaultTemplate = useCallback(
    (templateId: string | null) => updatePreference({ defaultTemplate: templateId }),
    [updatePreference]
  );

  return {
    preferences,
    isLoading,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    setListViewMode,
    setSortPreference,
    setLastViewedWorkflowId,
    setDefaultTemplate,
  };
}
