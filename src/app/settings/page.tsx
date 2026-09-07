"use client";

import ThemeSelector from "@/components/theme/ThemeSelector";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
        Settings
      </h1>

      <section className="card">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Appearance
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Choose your preferred color theme. System will follow your operating
          system setting.
        </p>
        <ThemeSelector />
      </section>
    </div>
  );
}
