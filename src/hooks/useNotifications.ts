"use client";

import { useState, useEffect, useCallback } from "react";

// localStorage keys (namespaced)
const STORAGE_KEY_ASKED = "agentis_notification_asked";
const STORAGE_KEY_DISMISSED = "agentis_notification_dismissed";

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export interface UseNotificationsResult {
  /** Current permission state */
  permissionState: NotificationPermissionState;
  /** Whether the user has previously been asked for permission */
  hasBeenAsked: boolean;
  /** Whether the user has dismissed the banner */
  hasDismissed: boolean;
  /** Request notification permission from the browser */
  requestPermission: () => Promise<NotificationPermissionState>;
  /** Mark the banner as dismissed */
  dismiss: () => void;
  /** Whether the banner should be shown */
  shouldShowBanner: boolean;
}

/**
 * Custom hook that encapsulates browser notification permission logic.
 *
 * - Checks current Notification.permission on mount
 * - Exposes requestPermission() to trigger the browser prompt
 * - Tracks whether permission has been asked via localStorage
 * - Graceful fallback: if window.Notification is undefined, state = 'unsupported'
 */
export function useNotifications(): UseNotificationsResult {
  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>("default");
  const [hasBeenAsked, setHasBeenAsked] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  // Initialize state on mount
  useEffect(() => {
    // Check if Notification API is supported
    if (typeof window === "undefined" || !window.Notification) {
      setPermissionState("unsupported");
      return;
    }

    // Read current browser permission
    setPermissionState(
      Notification.permission as NotificationPermissionState
    );

    // Read localStorage values
    try {
      const asked = localStorage.getItem(STORAGE_KEY_ASKED);
      const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
      setHasBeenAsked(asked === "true");
      setHasDismissed(dismissed === "true");
    } catch {
      // localStorage may be unavailable (e.g., private browsing in some browsers)
    }
  }, []);

  // Request permission from the browser
  const requestPermission =
    useCallback(async (): Promise<NotificationPermissionState> => {
      if (typeof window === "undefined" || !window.Notification) {
        setPermissionState("unsupported");
        return "unsupported";
      }

      try {
        const result = await Notification.requestPermission();
        const state = result as NotificationPermissionState;
        setPermissionState(state);
        setHasBeenAsked(true);

        // Persist that we've asked
        try {
          localStorage.setItem(STORAGE_KEY_ASKED, "true");
        } catch {
          // Silent fail if localStorage is unavailable
        }

        return state;
      } catch {
        // Some older browsers may throw on requestPermission
        setPermissionState("denied");
        return "denied";
      }
    }, []);

  // Dismiss the banner
  const dismiss = useCallback(() => {
    setHasDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    } catch {
      // Silent fail if localStorage is unavailable
    }
  }, []);

  // Compute whether the banner should be shown
  const shouldShowBanner =
    permissionState === "default" && !hasDismissed && !hasBeenAsked;

  return {
    permissionState,
    hasBeenAsked,
    hasDismissed,
    requestPermission,
    dismiss,
    shouldShowBanner,
  };
}
