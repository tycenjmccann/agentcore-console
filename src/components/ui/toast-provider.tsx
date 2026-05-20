"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastData, type ToastVariant } from "./toast";

export interface ToastOptions {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_DURATION = 5000;

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (options: ToastOptions): string => {
      counterRef.current += 1;
      const id = `toast-${counterRef.current}-${Date.now()}`;
      const duration = options.duration ?? DEFAULT_DURATION;

      const newToast: ToastData = {
        id,
        variant: options.variant,
        title: options.title,
        description: options.description,
        duration,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // If exceeding max, dismiss oldest
        if (updated.length > MAX_VISIBLE_TOASTS) {
          const toRemove = updated.slice(0, updated.length - MAX_VISIBLE_TOASTS);
          toRemove.forEach((t) => {
            const timer = timersRef.current.get(t.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(t.id);
            }
          });
          return updated.slice(-MAX_VISIBLE_TOASTS);
        }
        return updated;
      });

      // Set auto-dismiss timer
      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [dismissToast]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAll }}>
      {children}
      {/* Toast container - fixed bottom-right */}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
