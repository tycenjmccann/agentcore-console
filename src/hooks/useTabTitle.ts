"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Default application title used when tab regains focus.
 */
const DEFAULT_TITLE = "Agentis Hub";

export type TabTitleStatus = "complete" | "error" | "default";

export interface UseTabTitleOptions {
  /** Custom default title (defaults to "Agentis Hub") */
  defaultTitle?: string;
}

export interface UseTabTitleResult {
  /** Set the tab title to reflect a workflow status */
  setStatus: (status: TabTitleStatus) => void;
  /** Manually reset the title to the default */
  reset: () => void;
}

/**
 * Custom hook to manage the browser tab title based on workflow status.
 *
 * - When workflow completes: sets document.title = "✓ Agentis Hub"
 * - When workflow errors: sets document.title = "✗ Agentis Hub"
 * - Listens for `visibilitychange`: resets to default when user returns to tab
 * - Cleans up event listener on unmount
 * - If multiple workflows complete, reflects the most recent state
 */
export function useTabTitle(options?: UseTabTitleOptions): UseTabTitleResult {
  const defaultTitle = options?.defaultTitle ?? DEFAULT_TITLE;
  const currentStatusRef = useRef<TabTitleStatus>("default");

  // Update document.title based on status
  const applyTitle = useCallback(
    (status: TabTitleStatus) => {
      switch (status) {
        case "complete":
          document.title = `✓ ${defaultTitle}`;
          break;
        case "error":
          document.title = `✗ ${defaultTitle}`;
          break;
        case "default":
        default:
          document.title = defaultTitle;
          break;
      }
    },
    [defaultTitle]
  );

  // Set the status and update title
  const setStatus = useCallback(
    (status: TabTitleStatus) => {
      currentStatusRef.current = status;
      applyTitle(status);
    },
    [applyTitle]
  );

  // Reset to default
  const reset = useCallback(() => {
    currentStatusRef.current = "default";
    applyTitle("default");
  }, [applyTitle]);

  // Listen for visibilitychange to reset title when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        currentStatusRef.current = "default";
        applyTitle("default");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyTitle]);

  return { setStatus, reset };
}
