"use client";

import { useState, useEffect } from "react";
import { Search, Globe, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/agents": "Agents",
  "/build": "Build",
};

export default function Header() {
  const pathname = usePathname();
  const title = pathname.startsWith("/agents/") && pathname !== "/agents"
    ? "Agent Detail"
    : pageTitles[pathname] || "AgentCore Console";

  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/agentcore/region")
      .then((r) => r.json())
      .then((data) => {
        setRegion(data.current || "");
        setRegions(data.available || []);
      })
      .catch(() => {});
  }, []);

  const switchRegion = async (newRegion: string) => {
    if (newRegion === region) {
      setShowDropdown(false);
      return;
    }
    setSwitching(true);
    setShowDropdown(false);
    try {
      const res = await fetch("/api/agentcore/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: newRegion }),
      });
      const data = await res.json();
      if (data.current) {
        setRegion(data.current);
        // Reload page to refresh all data with new region
        window.location.reload();
      }
    } catch {
      // Failed to switch
    } finally {
      setSwitching(false);
    }
  };

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

        {/* Region Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors text-xs"
            disabled={switching}
          >
            <Globe className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-gray-300 font-mono">
              {switching ? "switching..." : region || "loading..."}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface-2 border border-surface-4 rounded-lg shadow-xl z-50 py-1">
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => switchRegion(r)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-surface-3 transition-colors ${
                    r === region ? "text-brand-400" : "text-gray-400"
                  }`}
                >
                  {r}
                  {r === region && <span className="ml-2 text-[10px] text-gray-600">(active)</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
