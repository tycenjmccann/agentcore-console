"use client";

import { useState, useEffect } from "react";
import { Globe, ChevronDown, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import { invalidateCachePrefix } from "@/lib/client-cache";
import { getCurrentTheme, toggleTheme, type Theme } from "@/lib/theme";

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

  const [region, setRegion] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aws-region") || "us-east-1";
    }
    return "us-east-1";
  });
  const [regions, setRegions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Initialize theme state from DOM
    setTheme(getCurrentTheme());

    // Fetch available regions from the server (just the list, no mutable state)
    fetch("/api/agentcore/region")
      .then((r) => r.json())
      .then((data) => {
        setRegions(data.available || []);
        // If localStorage doesn't have a region yet, use the server default
        if (!localStorage.getItem("aws-region") && data.current) {
          localStorage.setItem("aws-region", data.current);
          setRegion(data.current);
        }
      })
      .catch(() => {});
  }, []);

  const switchRegion = (newRegion: string) => {
    if (newRegion === region) {
      setShowDropdown(false);
      return;
    }
    // Store in localStorage — all future fetch calls will read from here
    localStorage.setItem("aws-region", newRegion);
    setRegion(newRegion);
    setShowDropdown(false);
    // Invalidate all cached data so it refetches with new region
    invalidateCachePrefix("/api/");
    // Reload page to refresh all data with new region
    window.location.reload();
  };

  const handleThemeToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
  };

  return (
    <header className="h-14 border-b flex items-center justify-between px-6"
      style={{
        backgroundColor: "rgb(var(--color-bg-secondary))",
        borderColor: "rgb(var(--color-border-primary))"
      }}
    >
      <h2 className="text-lg font-semibold" style={{ color: "rgb(var(--color-text-primary))" }}>
        {title}
      </h2>

      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button
          onClick={handleThemeToggle}
          className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all"
          style={{
            backgroundColor: "rgb(var(--color-bg-tertiary))",
            borderColor: "rgb(var(--color-border-primary))"
          }}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" style={{ color: "rgb(var(--color-brand-400))" }} />
          ) : (
            <Moon className="w-4 h-4" style={{ color: "rgb(var(--color-brand-400))" }} />
          )}
        </button>

        {/* Region Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors text-xs"
            style={{
              backgroundColor: "rgb(var(--color-bg-tertiary))",
              borderColor: "rgb(var(--color-border-primary))"
            }}
          >
            <Globe className="w-3.5 h-3.5" style={{ color: "rgb(var(--color-brand-400))" }} />
            <span className="font-mono" style={{ color: "rgb(var(--color-text-secondary))" }}>
              {region || "loading..."}
            </span>
            <ChevronDown className="w-3 h-3" style={{ color: "rgb(var(--color-text-tertiary))" }} />
          </button>

          {showDropdown && (
            <div 
              className="absolute right-0 top-full mt-1 w-48 border rounded-lg shadow-xl z-50 py-1"
              style={{
                backgroundColor: "rgb(var(--color-bg-tertiary))",
                borderColor: "rgb(var(--color-border-primary))"
              }}
            >
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => switchRegion(r)}
                  className="w-full text-left px-3 py-1.5 text-xs font-mono transition-colors"
                  style={{
                    color: r === region 
                      ? "rgb(var(--color-brand-400))" 
                      : "rgb(var(--color-text-tertiary))",
                    backgroundColor: "transparent"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgb(var(--color-bg-elevated))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {r}
                  {r === region && (
                    <span className="ml-2 text-[10px]" style={{ color: "rgb(var(--color-text-tertiary))" }}>
                      (active)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
