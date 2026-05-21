"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Hammer,
  Workflow,
  History,
  GitPullRequest,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar-collapsed";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/build", label: "Build", icon: Hammer },
  { href: "/workflow", label: "Workflow", icon: GitPullRequest },
  { href: "/routing", label: "Routing", icon: Workflow },
  { href: "/tickets", label: "Ticket History", icon: History },
];

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, String(collapsed));
        document.documentElement.setAttribute(
          "data-sidebar-collapsed",
          String(collapsed)
        );
      } catch {
        // localStorage unavailable
      }
    }
  }, [collapsed, mounted]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        "fixed left-0 top-0 h-screen bg-surface-1 border-r border-surface-4 flex flex-col z-50",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo / Brand */}
      <div className="p-4 border-b border-surface-4 flex items-center min-h-[73px]">
        <div className={cn("flex items-center", collapsed ? "justify-center w-full" : "gap-3")}>
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                Agentis
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">Hub</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1" aria-label="Sidebar navigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="overflow-hidden whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Link>
              {/* CSS-only Tooltip - only visible when collapsed */}
              {collapsed && (
                <div
                  role="tooltip"
                  className={cn(
                    "absolute left-full top-1/2 -translate-y-1/2 ml-2",
                    "px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap",
                    "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-surface-4",
                    "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                    "transition-opacity duration-200 z-[100]",
                    "pointer-events-none"
                  )}
                >
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Toggle Button */}
      <div className="p-2 border-t border-surface-4">
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center justify-center w-full rounded-lg py-2.5 text-sm font-medium",
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-[var(--color-surface-1)]"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="overflow-hidden whitespace-nowrap">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
