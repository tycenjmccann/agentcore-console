/**
 * Global Loading State Context
 * 
 * Allows any component to report loading state, and the Header
 * can subscribe to show a global spinner.
 */

"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface LoadingContextValue {
  isLoading: boolean;
  loadingKeys: Set<string>;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
}

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  const startLoading = useCallback((key: string) => {
    setLoadingKeys((prev) => new Set(prev).add(key));
  }, []);

  const stopLoading = useCallback((key: string) => {
    setLoadingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isLoading: loadingKeys.size > 0,
        loadingKeys,
        startLoading,
        stopLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return context;
}

/**
 * Hook for automatic loading state management.
 * Call startLoading when starting an async operation,
 * and stopLoading when complete.
 */
export function useLoadingState(key: string) {
  const { startLoading, stopLoading } = useLoading();
  
  return {
    start: () => startLoading(key),
    stop: () => stopLoading(key),
  };
}
