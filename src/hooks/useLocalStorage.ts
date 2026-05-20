"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook to persist state in localStorage.
 * SSR-safe: reads from localStorage only after mount to avoid hydration mismatches.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored));
      }
    } catch (e) {
      console.warn(`[useLocalStorage] Failed to read key "${key}":`, e);
    }
    setIsHydrated(true);
  }, [key]);

  // Write to localStorage on change (after hydration)
  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(prev)
            : newValue;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch (e) {
          console.warn(`[useLocalStorage] Failed to write key "${key}":`, e);
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue];
}
