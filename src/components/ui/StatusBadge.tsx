import clsx from "clsx";

export type StatusVariant = "success" | "warning" | "error" | "info" | "neutral" | "active";

export interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
  className?: string;
}

const variantStyles: Record<StatusVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: "bg-green-400/10",
    text: "text-green-400",
    border: "border-green-400/30",
    dot: "bg-green-400",
  },
  warning: {
    bg: "bg-amber-400/10",
    text: "text-amber-400",
    border: "border-amber-400/30",
    dot: "bg-amber-400",
  },
  error: {
    bg: "bg-red-400/10",
    text: "text-red-400",
    border: "border-red-400/30",
    dot: "bg-red-400",
  },
  info: {
    bg: "bg-blue-400/10",
    text: "text-blue-400",
    border: "border-blue-400/30",
    dot: "bg-blue-400",
  },
  neutral: {
    bg: "bg-gray-400/10",
    text: "text-gray-400",
    border: "border-gray-400/30",
    dot: "bg-gray-400",
  },
  active: {
    bg: "bg-brand-400/10",
    text: "text-brand-400",
    border: "border-brand-400/30",
    dot: "bg-brand-400",
  },
};

const sizeStyles: Record<"sm" | "md" | "lg", { padding: string; fontSize: string; dot: string }> = {
  sm: {
    padding: "px-1.5 py-0.5",
    fontSize: "text-[10px]",
    dot: "w-1.5 h-1.5",
  },
  md: {
    padding: "px-2 py-0.5",
    fontSize: "text-xs",
    dot: "w-2 h-2",
  },
  lg: {
    padding: "px-2.5 py-1",
    fontSize: "text-sm",
    dot: "w-2.5 h-2.5",
  },
};

export const statusVariantMap: Record<string, StatusVariant> = {
  // Active states
  running: "active",
  active: "active",
  streaming: "active",
  processing: "active",
  ACTIVE: "active",

  // Success states
  ready: "success",
  READY: "success",
  complete: "success",
  completed: "success",
  done: "success",
  healthy: "success",

  // Warning states
  warning: "warning",
  degraded: "warning",
  pending: "warning",
  queued: "warning",

  // Error states
  failed: "error",
  error: "error",
  unhealthy: "error",
  timeout: "error",

  // Info states
  info: "info",
  starting: "info",
  updating: "info",

  // Neutral states
  idle: "neutral",
  stopped: "neutral",
  unknown: "neutral",
  inactive: "neutral",
  NOT_READY: "neutral",
};

export function StatusBadge({ variant, label, size = "md", showDot = false, className }: StatusBadgeProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  return (
    <span
      aria-label={`Status: ${label}`}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        styles.bg,
        styles.text,
        styles.border,
        sizes.padding,
        sizes.fontSize,
        className
      )}
    >
      {showDot && (
        <span
          className={clsx(
            "rounded-full flex-shrink-0",
            styles.dot,
            sizes.dot,
            variant === "active" && "animate-pulse"
          )}
        />
      )}
      {label}
    </span>
  );
}

export default StatusBadge;
