"use client";

interface PhaseConnectorProps {
  fromStatus: "pending" | "active" | "completed";
  toStatus: "pending" | "active" | "completed";
}

/**
 * SVG connector line between two adjacent phases.
 * Animates when the source phase completes.
 */
export function PhaseConnector({ fromStatus, toStatus }: PhaseConnectorProps) {
  const isActive = fromStatus === "completed";
  const isFullyConnected = fromStatus === "completed" && toStatus !== "pending";

  return (
    <div className="pipeline-connector-wrapper">
      <svg
        className="pipeline-connector-svg"
        viewBox="0 0 48 24"
        fill="none"
        preserveAspectRatio="none"
      >
        {/* Background track */}
        <path
          d="M0 12 L48 12"
          stroke="rgba(42, 42, 58, 0.8)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Animated foreground */}
        <path
          d="M0 12 L48 12"
          stroke={isFullyConnected ? "#10b981" : isActive ? "#0ea5e9" : "transparent"}
          strokeWidth="2"
          strokeLinecap="round"
          className={
            isActive
              ? "pipeline-connector-animate"
              : ""
          }
        />
        {/* Arrow head */}
        <path
          d="M40 6 L48 12 L40 18"
          stroke={isFullyConnected ? "#10b981" : isActive ? "#0ea5e9" : "rgba(42, 42, 58, 0.8)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className={
            isActive ? "pipeline-connector-arrow-animate" : ""
          }
        />
      </svg>
    </div>
  );
}
