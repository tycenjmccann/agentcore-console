"use client";

import { createContext, useContext } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

export interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  setPreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined
);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean
): EffectiveTheme {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
}
