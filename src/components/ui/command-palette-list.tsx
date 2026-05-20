"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { CommandPaletteItem } from "./command-palette-item";
import type { CommandItem } from "./use-command-palette";

interface CommandPaletteListProps {
  results: CommandItem[];
  activeIndex: number;
  onSelect: (item: CommandItem) => void;
  onHover: (index: number) => void;
  hasRecentItems: boolean;
  query: string;
}

export const CommandPaletteList = forwardRef<HTMLDivElement, CommandPaletteListProps>(
  function CommandPaletteList({ results, activeIndex, onSelect, onHover, hasRecentItems, query }, ref) {
    if (results.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          No results found for &ldquo;{query}&rdquo;
        </div>
      );
    }

    const groupLabel = !query.trim()
      ? hasRecentItems
        ? "Recent"
        : "Commands"
      : "Commands";

    return (
      <div
        ref={ref}
        className={cn("max-h-[320px] overflow-y-auto px-2 py-2")}
        role="listbox"
        aria-label="Command results"
      >
        <div className="px-2 py-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {groupLabel}
          </span>
        </div>
        {results.map((item, index) => (
          <CommandPaletteItem
            key={item.id}
            item={item}
            isActive={index === activeIndex}
            index={index}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    );
  }
);
