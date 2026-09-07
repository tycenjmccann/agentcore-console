'use client';

import { useTheme } from '@/providers/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        onClick={toggleTheme}
        className={`
          relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center
          rounded-full border transition-colors duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-2)]
          ${isDark
            ? 'bg-[var(--color-toggle-track-on)] border-transparent'
            : 'bg-[var(--color-toggle-track-off)] border-[var(--color-toggle-track-off-border)]'
          }
        `}
      >
        <Sun
          className={`absolute left-1.5 h-3.5 w-3.5 transition-opacity duration-200
            ${isDark ? 'opacity-40 text-white' : 'opacity-100 text-white'}
          `}
          aria-hidden="true"
        />
        <Moon
          className={`absolute right-1.5 h-3.5 w-3.5 transition-opacity duration-200
            ${isDark ? 'opacity-100 text-white' : 'opacity-40 text-white'}
          `}
          aria-hidden="true"
        />
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full
            bg-[var(--color-toggle-thumb)] shadow-sm
            transform transition-transform duration-200
            ${isDark ? 'translate-x-[22px]' : 'translate-x-[3px]'}
          `}
          aria-hidden="true"
        />
      </button>
      <span className="text-sm text-[var(--color-text-muted)] select-none" aria-hidden="true">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </div>
  );
}
