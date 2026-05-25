"use client";

import ThemeToggle from "@/components/layout/ThemeToggle";
import { useTheme } from "@/lib/theme";
import { Palette } from "lucide-react";

export default function SettingsPage() {
  const { theme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Settings</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Manage your application preferences
        </p>
      </div>

      {/* Appearance Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-brand-400" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Appearance</h3>
        </div>

        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-surface-2 border border-surface-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Dark Mode</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {theme === "dark"
                  ? "Dark theme is currently active"
                  : "Light theme is currently active"}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
