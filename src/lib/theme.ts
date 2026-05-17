/**
 * Theme Management Utility
 * 
 * Handles light/dark theme switching with:
 * - localStorage persistence
 * - System preference detection
 * - FOUC prevention
 */

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme-preference";

/**
 * Get the initial theme based on priority:
 * 1. localStorage preference (if set)
 * 2. System preference (prefers-color-scheme)
 * 3. Default to dark
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark"; // SSR default
  }

  // Check localStorage first
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  // Default to dark
  return "dark";
}

/**
 * Apply theme to the document
 * @param theme - "light" or "dark"
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  
  // Also set class for compatibility with existing Tailwind dark: variants
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Set theme and persist to localStorage
 * @param theme - "light" or "dark"
 */
export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * Toggle between light and dark themes
 * @returns The new theme
 */
export function toggleTheme(): Theme {
  const current = getCurrentTheme();
  const next: Theme = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/**
 * Get the currently active theme
 */
export function getCurrentTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  
  const root = document.documentElement;
  const dataTheme = root.getAttribute("data-theme");
  
  if (dataTheme === "light" || dataTheme === "dark") {
    return dataTheme;
  }
  
  // Fallback to checking class
  return root.classList.contains("dark") ? "dark" : "light";
}

/**
 * Listen for system theme preference changes
 * @param callback - Called when system preference changes
 * @returns Cleanup function to remove listener
 */
export function watchSystemTheme(callback: (theme: Theme) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  
  const handler = (e: MediaQueryListEvent) => {
    // Only update if user hasn't set a manual preference
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      const theme: Theme = e.matches ? "dark" : "light";
      applyTheme(theme);
      callback(theme);
    }
  };

  mediaQuery.addEventListener("change", handler);
  
  return () => {
    mediaQuery.removeEventListener("change", handler);
  };
}

/**
 * Inline script to prevent FOUC (Flash of Unstyled Content)
 * This should be injected in the <head> before any content renders
 */
export const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme-preference');
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    console.error('Theme init error:', e);
  }
})();
`;
