"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type ViewMode = "compact" | "full";

interface UseViewportModeReturn {
  viewMode: ViewMode;
  toggleView: () => void;
  isAutoDetected: boolean;
  isMobile: boolean;
}

const STORAGE_KEY = "pipeline-view-preference";
const WIDE_BREAKPOINT = 1600;
const MOBILE_BREAKPOINT = 768;
const DEBOUNCE_MS = 175;

/**
 * Custom hook for viewport-aware pipeline view mode.
 *
 * Detects viewport width on mount and resize (debounced).
 * Auto-switches to compact when < 1600px.
 * Reads/writes localStorage key `pipeline-view-preference`.
 * Preference hierarchy: localStorage > auto-detection.
 *
 * @returns { viewMode, toggleView, isAutoDetected, isMobile }
 */
export function useViewportMode(): UseViewportModeReturn {
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [isAutoDetected, setIsAutoDetected] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine auto-detected mode from viewport width
  const getAutoMode = useCallback((): ViewMode => {
    if (typeof window === "undefined") return "compact";
    return window.innerWidth >= WIDE_BREAKPOINT ? "full" : "compact";
  }, []);

  // Read stored preference
  const getStoredPreference = useCallback((): ViewMode | null => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "compact" || stored === "full") return stored;
    } catch {
      // localStorage unavailable
    }
    return null;
  }, []);

  // Initialize on mount
  useEffect(() => {
    const stored = getStoredPreference();
    const mobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(mobile);

    if (mobile) {
      // Force compact on mobile regardless of preference
      setViewMode("compact");
      setIsAutoDetected(true);
    } else if (stored) {
      setViewMode(stored);
      setIsAutoDetected(false);
    } else {
      const auto = getAutoMode();
      setViewMode(auto);
      setIsAutoDetected(true);
    }
  }, [getAutoMode, getStoredPreference]);

  // Handle resize with debounce
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const mobile = window.innerWidth < MOBILE_BREAKPOINT;
        setIsMobile(mobile);

        if (mobile) {
          // Force compact on mobile
          setViewMode("compact");
          setIsAutoDetected(true);
          return;
        }

        // Only auto-switch if user hasn't manually set a preference
        const stored = getStoredPreference();
        if (!stored) {
          const auto = getAutoMode();
          setViewMode(auto);
          setIsAutoDetected(true);
        }
      }, DEBOUNCE_MS);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [getAutoMode, getStoredPreference]);

  // Toggle between compact and full
  const toggleView = useCallback(() => {
    setViewMode((current) => {
      const next: ViewMode = current === "compact" ? "full" : "compact";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      setIsAutoDetected(false);
      return next;
    });
  }, []);

  return { viewMode, toggleView, isAutoDetected, isMobile };
}
