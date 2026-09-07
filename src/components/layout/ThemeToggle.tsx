"use client";

import { useTheme, ThemePreference } from "@/lib/theme";
import { useRef, useState } from "react";

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
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const cycleOrder: ThemePreference[] = ["system", "dark", "light"];

function getNextPreference(current: ThemePreference): ThemePreference {
  const idx = cycleOrder.indexOf(current);
  return cycleOrder[(idx + 1) % cycleOrder.length];
}

function getLabel(pref: ThemePreference): string {
  switch (pref) {
    case "light":
      return "Theme: Light. Click to switch to System.";
    case "dark":
      return "Theme: Dark. Click to switch to Light.";
    case "system":
      return "Theme: System. Click to switch to Dark.";
  }
}

function getIcon(pref: ThemePreference) {
  switch (pref) {
    case "light":
      return <SunIcon />;
    case "dark":
      return <MoonIcon />;
    case "system":
      return <MonitorIcon />;
  }
}

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const [announcement, setAnnouncement] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleClick = () => {
    const next = getNextPreference(preference);
    setPreference(next);
    const msg = `Theme set to ${next}`;
    setAnnouncement(msg);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAnnouncement(""), 3000);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors text-[var(--color-text-secondary)]"
        aria-label={getLabel(preference)}
        title={`Theme: ${preference}`}
      >
        {getIcon(preference)}
      </button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  );
}
