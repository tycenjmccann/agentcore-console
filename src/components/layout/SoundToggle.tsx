"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useCompletionSound } from "@/hooks/useCompletionSound";

/**
 * Speaker icon toggle button for the app header.
 * Shows 🔊 when sound is enabled and 🔇 when muted.
 * Clicking toggles the notification sound mute state.
 */
export default function SoundToggle() {
  const { isMuted, toggleMute } = useCompletionSound();

  return (
    <button
      onClick={toggleMute}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-surface-4 hover:border-brand-500/50 transition-colors"
      aria-label={isMuted ? "Unmute notification sounds" : "Mute notification sounds"}
      title="Toggle notification sounds"
    >
      {isMuted ? (
        <VolumeX className="w-4 h-4 text-[var(--color-text-muted)]" />
      ) : (
        <Volume2 className="w-4 h-4 text-brand-400" />
      )}
    </button>
  );
}
