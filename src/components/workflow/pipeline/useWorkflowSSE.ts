"use client";

import { useEffect, useRef } from "react";
import type { WorkflowEvent } from "@/lib/workflow/types";
import { usePipeline, useDispatchWorkflowEvent } from "./PipelineContext";

/**
 * SSE hook that subscribes to workflow events and dispatches
 * them to the pipeline state. Only connects after hydration
 * to avoid replaying old state.
 */
export function useWorkflowSSE(workflowId: string) {
  const { state } = usePipeline();
  const dispatchEvent = useDispatchWorkflowEvent();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workflowId) return;

    // Don't connect until we've hydrated initial state
    if (!state.hydratedAt) return;

    const url = `/api/workflow/${workflowId}/events`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WorkflowEvent;
        dispatchEvent(data);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; we just log
      console.warn("[Pipeline SSE] Connection error, will retry...");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [workflowId, dispatchEvent, state.hydratedAt]);
}
