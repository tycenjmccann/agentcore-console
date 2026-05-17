"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { getInitialTheme, saveTheme, applyTheme, toggleTheme, type Theme } from "@/lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initialize theme on mount
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a preference
      try {
        const stored = localStorage.getItem('theme-preference');
        if (!stored) {
          const newTheme = e.matches ? 'dark' : 'light';
          setTheme(newTheme);
          applyTheme(newTheme);
        }
      } catch (error) {
        console.warn('Failed to handle system theme change:', error);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleToggle = () => {
    const newTheme = toggleTheme(theme);
    setTheme(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-surface-2 border border-surface-4" />
    );
  }

  const Icon = theme === 'light' ? Moon : Sun;
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <button
      onClick={handleToggle}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors"
      aria-label={label}
      title={label}
    >
      <Icon className="w-4 h-4 text-brand-400" />
    </button>
  );
}
