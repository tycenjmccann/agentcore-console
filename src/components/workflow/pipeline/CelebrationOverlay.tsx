"use client";

import { useEffect, useState } from "react";
import { usePipeline } from "./PipelineContext";
import { PartyPopper } from "lucide-react";

const PARTICLE_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

/**
 * Full-screen celebration overlay shown on workflow_complete.
 * Auto-dismisses after 4 seconds.
 */
export function CelebrationOverlay() {
  const { state, dispatch } = usePipeline();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state.showCelebration) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        dispatch({ type: "DISMISS_CELEBRATION" });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.showCelebration, dispatch]);

  if (!visible) return null;

  return (
    <div className="pipeline-celebration-overlay">
      {/* Burst particles */}
      <div className="pipeline-celebration-burst">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="pipeline-celebration-particle"
            style={{
              "--particle-angle": `${i * 30}deg`,
              "--particle-delay": `${i * 0.05}s`,
              "--particle-color": PARTICLE_COLORS[i % PARTICLE_COLORS.length],
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="pipeline-celebration-content">
        <PartyPopper className="w-12 h-12 text-yellow-400 mb-3" />
        <h2 className="text-2xl font-bold text-white">Workflow Complete!</h2>
        <p className="text-sm text-gray-400 mt-1">All phases finished successfully</p>
      </div>
    </div>
  );
}
