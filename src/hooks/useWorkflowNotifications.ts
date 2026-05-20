"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "./useNotifications";
import { useTabTitle } from "./useTabTitle";
import { AGENTIS_ICON_PATH } from "@/lib/constants";
import type { WorkflowPhase } from "@/lib/workflow/types";

export interface WorkflowNotificationTarget {
  /** Unique workflow ID */
  workflowId: string;
  /** Current workflow phase */
  phase: WorkflowPhase;
  /** Workflow title (used in notification body) */
  title: string;
}

export interface UseWorkflowNotificationsOptions {
  /** The workflow to monitor for phase transitions */
  workflow: WorkflowNotificationTarget | null;
}

/**
 * Hook that fires browser notifications and updates tab title
 * when a workflow reaches a terminal state ("complete" or "error").
 *
 * Features:
 * - Checks notification permission via useNotifications (from TEAM-526)
 * - Only fires when document.hidden === true (tab is not visible)
 * - Deduplicates notifications using a Set tracked in useRef
 * - On notification click: focuses the window and closes the notification
 * - Updates tab title via useTabTitle hook
 */
export function useWorkflowNotifications({
  workflow,
}: UseWorkflowNotificationsOptions): void {
  const { permissionState } = useNotifications();
  const { setStatus } = useTabTitle();

  // Track which workflow IDs have already been notified to prevent duplicates
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workflow) return;

    const { workflowId, phase, title } = workflow;
    const isTerminal = phase === "complete" || phase === "error";

    if (!isTerminal) return;

    // Generate a unique key per workflow + terminal state to allow
    // notifying once for complete AND once for error (edge case: error after re-run)
    const notificationKey = `${workflowId}:${phase}`;

    // Check if we've already notified for this specific workflow terminal event
    if (notifiedIdsRef.current.has(notificationKey)) return;

    // Mark as notified immediately (before async operations)
    notifiedIdsRef.current.add(notificationKey);

    // Update tab title regardless of notification permission
    if (phase === "complete") {
      setStatus("complete");
    } else {
      setStatus("error");
    }

    // Fire browser notification only if:
    // 1. Permission is granted
    // 2. Tab is currently hidden (user is not looking at it)
    if (permissionState !== "granted") return;
    if (!document.hidden) return;

    const notificationTitle =
      phase === "complete" ? "Workflow Complete" : "Workflow Failed";
    const notificationBody =
      phase === "complete"
        ? `${title} finished successfully`
        : `${title} encountered an error`;

    try {
      const notification = new Notification(notificationTitle, {
        body: notificationBody,
        icon: AGENTIS_ICON_PATH,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Graceful no-op if Notification constructor fails
      // (e.g., in some environments where it's not fully supported)
    }
  }, [workflow, permissionState, setStatus]);
}
