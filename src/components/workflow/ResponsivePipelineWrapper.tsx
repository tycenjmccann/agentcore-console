"use client";

import { useRef, useEffect, useState } from "react";
import type { ViewMode } from "@/hooks/useViewportMode";

interface ResponsivePipelineWrapperProps {
  viewMode: ViewMode;
  children: React.ReactNode;
  compactView: React.ReactNode;
}

/**
 * Wrapper component that handles smooth CSS transitions between
 * compact and full pipeline views.
 *
 * Uses opacity + transform transitions (~200ms) with no layout thrashing.
 */
export default function ResponsivePipelineWrapper({
  viewMode,
  children,
  compactView,
}: ResponsivePipelineWrapperProps) {
  const [activeView, setActiveView] = useState<ViewMode>(viewMode);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (viewMode !== activeView) {
      setIsTransitioning(true);

      // Wait for exit animation to complete before switching
      timerRef.current = setTimeout(() => {
        setActiveView(viewMode);
        // Small delay for enter animation
        requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      }, 150);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [viewMode, activeView]);

  return (
    <div className="pipeline-view-wrapper">
      <div
        className={isTransitioning ? "pipeline-view-exit" : "pipeline-view-enter"}
        style={{ width: "100%" }}
      >
        {activeView === "compact" ? compactView : children}
      </div>
    </div>
  );
}
