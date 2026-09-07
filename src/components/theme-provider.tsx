"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ThemeContext,
  ThemePreference,
  EffectiveTheme,
  resolveTheme,
} from "@/lib/theme";

const STORAGE_KEY = "theme-preference";

function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {}
  return "system";
}

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const storedPref = getStoredPreference();
    const isDark = getSystemDark();
    setPreferenceState(storedPref);
    setSystemDark(isDark);
    setMounted(true);
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const effectiveTheme: EffectiveTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (!isInitialMount.current) {
      html.classList.add("theme-transitioning");
      const timeout = setTimeout(() => {
        html.classList.remove("theme-transitioning");
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [effectiveTheme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme, mounted]);

  const setPreference = useCallback((pref: ThemePreference) => {
    isInitialMount.current = false;
    setPreferenceState(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, effectiveTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
