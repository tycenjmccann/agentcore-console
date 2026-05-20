"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Hammer, Workflow, History, GitPullRequest, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarContext } from "@/components/layout/sidebar/SidebarContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/build", label: "Build", icon: Hammer },
  { href: "/workflow", label: "Workflow", icon: GitPullRequest },
  { href: "/routing", label: "Routing", icon: Workflow },
  { href: "/tickets", label: "Ticket History", icon: History },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebarContext();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-surface-1 border-r border-surface-4 flex flex-col z-50 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className={cn("border-b border-surface-4", isCollapsed ? "p-4" : "p-6")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Agentis</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Hub</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3",
                isCollapsed && "justify-center px-0"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 rounded bg-surface-4 text-xs text-[var(--color-text-primary)] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-surface-4">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full py-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3 transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
