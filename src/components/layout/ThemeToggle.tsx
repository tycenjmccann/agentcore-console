"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    toggleTheme();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-surface-4">
        <div className="w-4 h-4" />
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className="group flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 hover:bg-surface-3 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      role="switch"
      aria-checked={theme === "dark"}
    >
      <div className="relative w-4 h-4">
        {/* Sun icon for dark mode (shows when in dark mode) */}
        <Sun
          className={`absolute inset-0 w-4 h-4 text-yellow-400 transition-all duration-300 ${
            theme === "dark"
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 rotate-90 scale-50"
          }`}
          aria-hidden="true"
        />
        {/* Moon icon for light mode (shows when in light mode) */}
        <Moon
          className={`absolute inset-0 w-4 h-4 text-blue-400 transition-all duration-300 ${
            theme === "light"
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 -rotate-90 scale-50"
          }`}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
