"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { useTheme, ThemePreference } from "@/lib/theme";

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const options: { value: ThemePreference; label: string; icon: JSX.Element }[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

export default function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  const [announcement, setAnnouncement] = useState("");
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const selectedIndex = options.findIndex((o) => o.value === preference);

  const handleSelect = (value: ThemePreference) => {
    setPreference(value);
    const msg = `Theme set to ${value}`;
    setAnnouncement(msg);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAnnouncement(""), 3000);
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    }
    if (nextIndex !== null) {
      buttonsRef.current[nextIndex]?.focus();
      handleSelect(options[nextIndex].value);
    }
  };

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Color theme preference"
        className="relative inline-flex items-center h-10 p-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)]"
      >
        {/* Sliding indicator */}
        <div
          className="absolute h-8 rounded-2xl bg-[var(--color-accent)] transition-transform duration-200 ease-in-out"
          style={{
            width: `calc(${100 / options.length}% - 4px)`,
            transform: `translateX(calc(${selectedIndex * 100}% + ${selectedIndex * 4}px))`,
            left: "2px",
          }}
          aria-hidden="true"
        />

        {options.map((option, index) => {
          const isSelected = preference === option.value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                buttonsRef.current[index] = el;
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(option.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-colors duration-200 ${
                isSelected
                  ? "text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  );
}
