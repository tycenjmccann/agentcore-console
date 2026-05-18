"use client";

import type { PhaseVisualStatus } from "./usePipelineState";

interface PhaseConnectorProps {
  fromStatus: PhaseVisualStatus;
  toStatus: PhaseVisualStatus;
  suppressAnimation: boolean;
  isCelebrating: boolean;
}

export default function PhaseConnector({
  fromStatus,
  toStatus,
  suppressAnimation,
  isCelebrating,
}: PhaseConnectorProps) {
  // Connector is "active" when data is flowing (from is done/active, to is active)
  const isFlowing = fromStatus === "done" || (fromStatus === "active" && toStatus === "active");
  const isDone = fromStatus === "done" && toStatus === "done";

  return (
    <div className="flex items-center w-12 shrink-0">
      <svg
        width="48"
        height="40"
        viewBox="0 0 48 40"
        className="overflow-visible"
      >
        {/* Base path */}
        <path
          d="M 0 20 C 16 20, 32 20, 48 20"
          fill="none"
          stroke={isDone ? "#22c55e" : isFlowing ? "#0ea5e9" : "#2a2a3a"}
          strokeWidth="2"
          strokeLinecap="round"
          className={`${!suppressAnimation ? "transition-colors duration-500" : ""} ${
            isCelebrating && !suppressAnimation ? "stroke-orange-500" : ""
          }`}
        />

        {/* Animated flowing dot */}
        {isFlowing && !isDone && !suppressAnimation && (
          <circle
            r="3"
            fill="#0ea5e9"
            className="pipeline-connector-dot"
          >
            <animateMotion
              dur="0.9s"
              repeatCount="indefinite"
              path="M 0 20 C 16 20, 32 20, 48 20"
            />
          </circle>
        )}

        {/* Done checkmark dot */}
        {isDone && (
          <circle
            cx="24"
            cy="20"
            r="3"
            fill="#22c55e"
            opacity="0.6"
          />
        )}
      </svg>
    </div>
  );
}
