import { ThemeToggle } from '@/components/settings/ThemeToggle';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-8">Settings</h1>

        <section className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Appearance</h2>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Theme</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Choose between light and dark mode.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </section>
      </div>
    </div>
  );
}
