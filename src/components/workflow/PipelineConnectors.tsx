"use client";

/**
 * SVG connector lines between pipeline phases.
 * Renders curved paths with gradient animation for active connections.
 */
import { useEffect, useRef, useState } from "react";
import type { PhaseStatus } from "@/lib/workflow/pipeline-types";

interface PipelineConnectorsProps {
  phaseStatuses: Record<string, PhaseStatus>;
  phaseIds: string[];
}

interface ConnectorLine {
  id: string;
  fromPhase: string;
  toPhase: string;
  path: string;
  active: boolean;
  show: boolean;
}

export default function PipelineConnectors({ phaseStatuses, phaseIds }: PipelineConnectorsProps) {
  const [connectors, setConnectors] = useState<ConnectorLine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Calculate connector paths between adjacent phases
    const calcConnectors = () => {
      if (!containerRef.current) return;
      const container = containerRef.current.parentElement;
      if (!container) return;

      const lines: ConnectorLine[] = [];

      for (let i = 0; i < phaseIds.length - 1; i++) {
        const fromEl = container.querySelector(`#${phaseIds[i]}`);
        const toEl = container.querySelector(`#${phaseIds[i + 1]}`);
        if (!fromEl || !toEl) continue;

        const containerRect = container.getBoundingClientRect();
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 3 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 3 - containerRect.top;

        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

        const fromStatus = phaseStatuses[phaseIds[i]] || "inactive";
        const toStatus = phaseStatuses[phaseIds[i + 1]] || "inactive";

        lines.push({
          id: `connector-${i}`,
          fromPhase: phaseIds[i],
          toPhase: phaseIds[i + 1],
          path,
          active: fromStatus === "done" && toStatus === "active",
          show: fromStatus !== "inactive",
        });
      }

      setConnectors(lines);
    };

    calcConnectors();
    const resizeObserver = new ResizeObserver(calcConnectors);
    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [phaseStatuses, phaseIds]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-10">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.2" />
          </linearGradient>
          <filter id="pathGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {connectors.map((c) => (
          <path
            key={c.id}
            d={c.path}
            className={`flow-path ${c.show ? "show" : ""} ${c.active ? "active" : ""}`}
          />
        ))}
      </svg>
    </div>
  );
}
