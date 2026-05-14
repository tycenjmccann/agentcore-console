"use client";

import { Search, Wifi } from "lucide-react";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/agents": "Agents",
  "/build": "Build",
};

export default function Header() {
  const pathname = usePathname();
  // Match /agents/[id] to "Agent Detail"
  const title = pathname.startsWith("/agents/") && pathname !== "/agents"
    ? "Agent Detail"
    : pageTitles[pathname] || "AgentCore Console";

  return (
    <header className="h-14 bg-surface-1 border-b border-surface-4 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search agents..."
            data-testid="global-search"
            className="bg-surface-2 border border-surface-4 rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500/50 w-64"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Wifi className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400">AgentCore</span>
        </div>
      </div>
    </header>
  );
}
