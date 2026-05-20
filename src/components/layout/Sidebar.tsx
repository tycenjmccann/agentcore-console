"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Hammer,
  Workflow,
  History,
  GitPullRequest,
  Plus,
  Rocket,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar/SidebarContext";
import AgentStatusList from "@/components/layout/sidebar/AgentStatusList";
import WorkflowHistory from "@/components/layout/sidebar/WorkflowHistory";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/build", label: "Build", icon: Hammer },
  { href: "/workflow", label: "Workflow", icon: GitPullRequest },
  { href: "/routing", label: "Routing", icon: Workflow },
  { href: "/tickets", label: "Ticket History", icon: History },
];

const quickActions = [
  { href: "/workflow?action=new", label: "New Workflow", icon: Plus },
  { href: "/build", label: "Deploy Agent", icon: Rocket },
  { href: "/tickets", label: "View Logs", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-surface-1 border-r border-surface-4 flex flex-col z-50 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      aria-label="Sidebar navigation"
      data-testid="sidebar"
    >
      {/* Logo Section */}
      <div className={cn("border-b border-surface-4", collapsed ? "p-3" : "p-6")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Agentis</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Hub</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto scrollbar-thin", collapsed ? "p-2" : "p-4")}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group",
                collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
                isActive
                  ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-surface-3"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
              {/* Tooltip for collapsed mode */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-surface-3 border border-surface-4 rounded text-xs text-[var(--color-text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-[60] transition-opacity shadow-lg">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Agent Status Section */}
      <AgentStatusList collapsed={collapsed} />

      {/* Workflow History Section */}
      <WorkflowHistory collapsed={collapsed} />

      {/* Quick Actions */}
      <div className={cn("border-t border-surface-4", collapsed ? "p-2" : "px-4 py-3")}>
        {!collapsed && (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Quick Actions
          </h3>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          {quickActions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              title={collapsed ? action.label : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg text-xs font-medium transition-colors relative group",
                collapsed
                  ? "p-2 justify-center hover:bg-surface-3"
                  : "px-3 py-2 hover:bg-surface-3",
                "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <action.icon className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && action.label}
              {/* Tooltip for collapsed mode */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-surface-3 border border-surface-4 rounded text-xs text-[var(--color-text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-[60] transition-opacity shadow-lg">
                  {action.label}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Collapse Toggle */}
      <div className="border-t border-surface-4 p-2">
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-surface-3 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="sidebar-collapse-toggle"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
          {!collapsed && (
            <span className="ml-2 text-xs">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  );
}
