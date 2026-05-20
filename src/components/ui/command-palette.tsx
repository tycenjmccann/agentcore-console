"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "./use-command-palette";
import { CommandPaletteInput } from "./command-palette-input";
import { CommandPaletteList } from "./command-palette-list";

export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const {
    isOpen,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    results,
    close,
    executeCommand,
    listRef,
    hasRecentItems,
  } = useCommandPalette(handleNavigate);

  // Focus trap: keep focus inside dialog
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleFocusTrap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const focusableElements = dialog!.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-[20vh]",
        "animate-in fade-in duration-150"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={close}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full max-w-lg mx-4",
          "bg-surface-1 border border-surface-4 rounded-xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-150"
        )}
      >
        <CommandPaletteInput value={query} onChange={setQuery} />
        <CommandPaletteList
          ref={listRef}
          results={results}
          activeIndex={activeIndex}
          onSelect={executeCommand}
          onHover={setActiveIndex}
          hasRecentItems={hasRecentItems}
          query={query}
        />

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2 border-t border-surface-4",
            "text-xs text-[var(--color-text-muted)]"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-surface-3 font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-surface-3 font-mono text-[10px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-surface-3 font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
          <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
