/**
 * Reusable Loading Spinner Component
 * 
 * Features:
 * - Pure CSS animation (GPU-accelerated)
 * - Theme-aware (uses existing brand colors)
 * - Accessible (ARIA labels)
 * - Multiple size variants
 * - Optional text label
 */

import { cn } from "@/lib/utils";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  "aria-label"?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "w-3 h-3 border",
  sm: "w-4 h-4 border",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
  xl: "w-12 h-12 border-[3px]",
};

export default function Spinner({
  size = "md",
  className,
  label,
  "aria-label": ariaLabel = "Loading",
}: SpinnerProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "spinner-ring",
          sizeClasses[size],
          "border-brand-600/20 border-t-brand-400"
        )}
        aria-label={ariaLabel}
      />
      {label && (
        <span className="text-sm text-gray-400 animate-pulse">{label}</span>
      )}
    </div>
  );
}
