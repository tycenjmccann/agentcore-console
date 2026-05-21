"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Hammer, Workflow, History, GitPullRequest, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
    return localStorage.getItem("sidebar-collapsed") === "true";
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
        localStorage.setItem("sidebar-collapsed", String(collapsed));
      } catch {
        // localStorage unavailable
      }
      // Update body class for main content margin
      document.documentElement.setAttribute("data-sidebar-collapsed", String(collapsed));
    }
  }, [collapsed, mounted]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <aside
      aria-expanded={!collapsed}
      className={cn(
        "fixed left-0 top-0 h-screen bg-surface-1 border-r border-surface-4 flex flex-col z-50",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-surface-4 flex items-center justify-between min-h-[73px]">
        <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="whitespace-nowrap overflow-hidden">
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Agentis</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Hub</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
              )}
              {/* CSS-only tooltip for collapsed mode */}
              {collapsed && (
                <span
                  className="sidebar-tooltip"
                  role="tooltip"
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle Button */}
      <div className="p-2 border-t border-surface-4">
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "w-full flex items-center justify-center p-2.5 rounded-lg",
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3",
            "transition-colors"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
