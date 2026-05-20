"use client";

import type { ViewMode } from "@/hooks/useViewportMode";

interface ViewToggleButtonProps {
  viewMode: ViewMode;
  onToggle: () => void;
  isAutoDetected: boolean;
}

/**
 * Toggle button for switching between compact and full pipeline views.
 * Shows expand/compact icon. Hidden on mobile (< 768px via CSS).
 */
export default function ViewToggleButton({
  viewMode,
  onToggle,
  isAutoDetected,
}: ViewToggleButtonProps) {
  const isCompact = viewMode === "compact";

  return (
    <button
      onClick={onToggle}
      className="view-toggle-btn hidden md:inline-flex"
      aria-label={isCompact ? "Switch to full pipeline view" : "Switch to compact pipeline view"}
      aria-pressed={isCompact}
      title={isCompact ? "Expand to full view" : "Compact view"}
    >
      {/* Icon: expand (arrows out) when compact, compress (arrows in) when full */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="view-toggle-icon"
      >
        {isCompact ? (
          // Expand icon - arrows pointing outward
          <>
            <path d="M2 6V2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 6V2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 10v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 10v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          // Compress icon - arrows pointing inward
          <>
            <path d="M4 2v4H0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(2, 0)" />
            <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(-2, 0)" />
            <path d="M4 14v-4H0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(2, 0)" />
            <path d="M12 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(-2, 0)" />
          </>
        )}
      </svg>
      <span className="view-toggle-label">
        {isCompact ? "Full" : "Compact"}
      </span>
      {isAutoDetected && (
        <span className="view-toggle-auto-badge">Auto</span>
      )}
    </button>
  );
}
