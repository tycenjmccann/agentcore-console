"use client";

import AvatarUpload from "@/components/profile/AvatarUpload";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Settings</h1>
      
      <section className="bg-surface-1 border border-surface-4 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Profile</h2>
        <AvatarUpload />
      </section>
      
      {/* Future: Add more settings sections here */}
    </div>
  );
}
