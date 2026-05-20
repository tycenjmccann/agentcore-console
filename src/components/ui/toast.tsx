"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const variantConfig: Record<
  ToastVariant,
  {
    icon: React.ElementType;
    containerClass: string;
    iconClass: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    containerClass:
      "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
    iconClass: "text-green-600 dark:text-green-400",
  },
  error: {
    icon: XCircle,
    containerClass:
      "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
    iconClass: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    containerClass:
      "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
    iconClass: "text-yellow-600 dark:text-yellow-400",
  },
  info: {
    icon: Info,
    containerClass:
      "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const { id, variant, title, description } = toast;
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(id);
    }, 200);
  };

  useEffect(() => {
    return () => {
      setIsExiting(false);
    };
  }, []);

  const ariaLive = variant === "error" ? "assertive" : "polite";

  return (
    <div
      role="alert"
      aria-live={ariaLive}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
        isExiting ? "animate-toast-fade-out" : "animate-toast-slide-in",
        config.containerClass
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", config.iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
