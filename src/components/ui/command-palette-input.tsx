"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CommandPaletteInput({ value, onChange }: CommandPaletteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount with slight delay for animation
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-surface-4")}>
      <Search
        className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a command or search..."
        className={cn(
          "flex-1 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
          "text-sm outline-none border-none"
        )}
        aria-label="Command palette search"
        aria-autocomplete="list"
        role="combobox"
        aria-expanded={true}
      />
      <kbd
        className={cn(
          "hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
          "bg-surface-3 text-[var(--color-text-muted)] text-xs font-mono"
        )}
      >
        ESC
      </kbd>
    </div>
  );
}
