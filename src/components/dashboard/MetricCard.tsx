"use client";

import { useEffect, useState, useRef } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import SparklineChart from "./SparklineChart";

interface MetricCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  sparklineData: number[];
  status: "green" | "yellow" | "red";
  loading?: boolean;
  animationDelay?: number;
  formatValue?: (value: number) => string;
}

const statusColors = {
  green: "bg-green-400",
  yellow: "bg-yellow-400",
  red: "bg-red-400",
};

const statusGlow = {
  green: "shadow-[0_0_6px_rgba(74,222,128,0.4)]",
  yellow: "shadow-[0_0_6px_rgba(250,204,21,0.4)]",
  red: "shadow-[0_0_6px_rgba(248,113,113,0.4)]",
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  sparklineData,
  status,
  loading = false,
  animationDelay = 0,
  formatValue,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Staggered fade-up animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), animationDelay);
    return () => clearTimeout(timer);
  }, [animationDelay]);

  // Animated count-up
  useEffect(() => {
    if (loading || !isVisible) return;

    const duration = 1200; // ms
    const startTime = performance.now();
    const startValue = 0;
    const endValue = value;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, loading, isVisible]);

  const formattedValue = formatValue ? formatValue(displayValue) : displayValue.toString();

  return (
    <div
      className={cn(
        "card p-5 transition-all duration-500 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", `${color}/10`)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium">
              {title}
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5 tabular-nums">
              {formattedValue}
            </p>
          </div>
        </div>
        {/* Status indicator dot */}
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full mt-1",
            statusColors[status],
            statusGlow[status]
          )}
          title={`Status: ${status}`}
        />
      </div>

      <p className="text-[11px] text-[var(--color-text-secondary)] mb-3 ml-12">
        {subtitle}
      </p>

      {/* Sparkline */}
      <div className="ml-0">
        <SparklineChart
          data={sparklineData}
          color={color.includes("brand") ? "#6366f1" : color.includes("green") ? "#4ade80" : color.includes("yellow") ? "#facc15" : color.includes("cyan") ? "#22d3ee" : "#6366f1"}
          height={40}
        />
      </div>
    </div>
  );
}
