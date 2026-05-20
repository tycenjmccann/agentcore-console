"use client";

import { useContext } from "react";
import { ToastContext, type ToastContextValue, type ToastOptions } from "@/components/ui/toast-provider";

export type { ToastOptions };

export interface UseToastReturn {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

export function useToast(): UseToastReturn {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast must be used within a ToastProvider. " +
        "Make sure to wrap your app with <ToastProvider>."
    );
  }

  return context;
}
