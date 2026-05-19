"use client";

import { useState, useEffect } from "react";
import { Globe, ChevronDown, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { invalidateCachePrefix } from "@/lib/client-cache";
import ThemeToggle from "./ThemeToggle";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/agents": "Agents",
  "/build": "Build",
  "/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
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

    // Fetch avatar on mount
    fetchAvatar();
    
    // Listen for avatar updates
    const handleAvatarUpdate = () => fetchAvatar();
    window.addEventListener('avatar-updated', handleAvatarUpdate);
    
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate);
    };
  }, []);

  const fetchAvatar = async () => {
    try {
      const res = await fetch('/api/profile/avatar');
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
        if (data.avatarUrl) {
          localStorage.setItem('user-avatar-url', data.avatarUrl);
        }
      }
    } catch (error) {
      console.error('Failed to fetch avatar:', error);
    }
  };

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

  return (
    <header className="h-14 bg-surface-1 border-b border-surface-4 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Region Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors text-xs"
          >
            <Globe className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[var(--color-text-secondary)] font-mono">
              {region || "loading..."}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface-2 border border-surface-4 rounded-lg shadow-xl z-50 py-1">
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => switchRegion(r)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-surface-3 transition-colors ${
                    r === region ? "text-brand-400" : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {r}
                  {r === region && <span className="ml-2 text-[10px] text-gray-600">(active)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Avatar */}
        <button
          onClick={() => router.push('/settings')}
          className="w-8 h-8 rounded-full bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors flex items-center justify-center overflow-hidden"
          title="Go to Settings"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
        </button>
      </div>
    </header>
  );
}
