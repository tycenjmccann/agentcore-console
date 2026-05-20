"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsiblePanelProps {
  children: React.ReactNode;
  /** Unique key for localStorage persistence */
  storageKey: string;
  /** Side the panel is on */
  side?: "left" | "right";
  /** Default width in pixels */
  defaultWidth?: number;
  /** Minimum width when expanded */
  minWidth?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Width when collapsed (just shows toggle button) */
  collapsedWidth?: number;
  /** Optional header content shown when collapsed */
  collapsedIcon?: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Panel title shown in header */
  title?: string;
  /** Header actions slot */
  headerActions?: React.ReactNode;
}

export default function CollapsiblePanel({
  children,
  storageKey,
  side = "left",
  defaultWidth = 300,
  minWidth = 200,
  maxWidth = 600,
  collapsedWidth = 44,
  collapsedIcon,
  className,
  title,
  headerActions,
}: CollapsiblePanelProps) {
  // Initialize state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(`${storageKey}-collapsed`);
    return stored === "true";
  });

  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return defaultWidth;
    const stored = localStorage.getItem(`${storageKey}-width`);
    const parsed = stored ? parseInt(stored, 10) : defaultWidth;
    return Math.max(minWidth, Math.min(maxWidth, parsed));
  });

  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Persist state
  useEffect(() => {
    localStorage.setItem(`${storageKey}-collapsed`, String(isCollapsed));
  }, [isCollapsed, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}-width`, String(width));
  }, [width, storageKey]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = side === "left"
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Prevent text selection while resizing
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, side, minWidth, maxWidth]);

  const currentWidth = isCollapsed ? collapsedWidth : width;
  const borderClass = side === "left" ? "border-r" : "border-l";
  const resizeHandlePosition = side === "left" ? "right-0" : "left-0";

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative flex-shrink-0 flex flex-col transition-[width] duration-200 ease-in-out",
        borderClass,
        "border-surface-4 bg-surface-1",
        isResizing && "transition-none",
        className
      )}
      style={{ width: currentWidth }}
      data-testid={`collapsible-panel-${storageKey}`}
    >
      {/* Collapse Toggle Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-surface-4 min-h-[40px]">
        {!isCollapsed && title && (
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide truncate">
            {title}
          </span>
        )}
        {!isCollapsed && headerActions && (
          <div className="flex items-center gap-1">{headerActions}</div>
        )}
        <button
          onClick={toggleCollapse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCollapse();
            }
          }}
          className={cn(
            "p-1.5 rounded-md hover:bg-surface-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors",
            isCollapsed && "mx-auto"
          )}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
          aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            side === "left" ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )
          ) : side === "left" ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Collapsed state icon */}
      {isCollapsed && collapsedIcon && (
        <div className="flex flex-col items-center pt-3 gap-2">
          {collapsedIcon}
        </div>
      )}

      {/* Panel content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {children}
        </div>
      )}

      {/* Resize handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "absolute top-0 bottom-0 w-1 cursor-col-resize z-10 group",
            resizeHandlePosition
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 w-1 transition-colors",
              isResizing
                ? "bg-brand-500/60"
                : "bg-transparent hover:bg-brand-500/30"
            )}
          />
        </div>
      )}
    </div>
  );
}
