"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Hammer, Workflow, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/build", label: "Build", icon: Hammer },
  { href: "/routing", label: "Routing", icon: Workflow },
  { href: "/tickets", label: "Ticket History", icon: History },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-64 border-r flex flex-col z-50"
      style={{
        backgroundColor: "rgb(var(--color-bg-secondary))",
        borderColor: "rgb(var(--color-border-primary))"
      }}
    >
      <div 
        className="p-6 border-b"
        style={{ borderColor: "rgb(var(--color-border-primary))" }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgb(var(--color-brand-600))" }}
          >
            <Bot className="w-5 h-5" style={{ color: "rgb(var(--color-text-inverse))" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "rgb(var(--color-text-primary))" }}>
              Agentis
            </h1>
            <p className="text-xs" style={{ color: "rgb(var(--color-text-tertiary))" }}>
              Hub
            </p>
          </div>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "border"
                  : ""
              )}
              style={
                isActive
                  ? {
                      backgroundColor: "rgb(var(--color-brand-600) / 0.2)",
                      color: "rgb(var(--color-brand-400))",
                      borderColor: "rgb(var(--color-brand-600) / 0.3)"
                    }
                  : {
                      color: "rgb(var(--color-text-tertiary))",
                      backgroundColor: "transparent"
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "rgb(var(--color-bg-elevated))";
                  e.currentTarget.style.color = "rgb(var(--color-text-secondary))";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "rgb(var(--color-text-tertiary))";
                }
              }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
