"use client";

import { cn } from "@/lib/utils";
import type { CommandItem } from "./use-command-palette";

interface CommandPaletteItemProps {
  item: CommandItem;
  isActive: boolean;
  index: number;
  onSelect: (item: CommandItem) => void;
  onHover: (index: number) => void;
}

export function CommandPaletteItem({
  item,
  isActive,
  index,
  onSelect,
  onHover,
}: CommandPaletteItemProps) {
  const Icon = item.icon;

  return (
    <button
      data-command-item
      type="button"
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75",
        "rounded-md cursor-pointer",
        isActive
          ? "bg-brand-600/20 text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-surface-3"
      )}
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(index)}
      role="option"
      aria-selected={isActive}
      id={`command-palette-item-${item.id}`}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          isActive ? "bg-brand-600/30" : "bg-surface-3"
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {item.description}
          </p>
        )}
      </div>

      {item.shortcut && item.shortcut.length > 0 && (
        <div className="hidden sm:flex items-center gap-1">
          {item.shortcut.map((key, i) => (
            <kbd
              key={i}
              className={cn(
                "inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded",
                "bg-surface-3 text-[var(--color-text-muted)] text-xs font-mono"
              )}
            >
              {key}
            </kbd>
          ))}
        </div>
      )}
    </button>
  );
}
