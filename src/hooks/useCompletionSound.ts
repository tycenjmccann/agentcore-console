"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "agentis_sound_enabled";

/**
 * Custom hook for playing completion/error notification sounds
 * using the Web Audio API. Generates tones programmatically — no external audio files.
 *
 * Success: Two ascending sine tones (C5 → E5)
 * Error: Two descending triangle tones (E4 → C4)
 */
export function useCompletionSound() {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default is sound ON (enabled). If stored value is "false", sound is muted.
      if (stored === "false") return true;
      return false;
    } catch {
      return false;
    }
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const contextResumedRef = useRef(false);

  // Initialize AudioContext lazily
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;

    // Check for Web Audio API support
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioCtx();
      } catch {
        return null;
      }
    }
    return audioContextRef.current;
  }, []);

  // Resume AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resumeContext = () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      contextResumedRef.current = true;
    };

    // Listen for user interaction events to resume AudioContext
    const events = ["click", "keydown", "touchstart"] as const;
    events.forEach((event) => {
      document.addEventListener(event, resumeContext, { once: false, passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resumeContext);
      });
    };
  }, []);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  /**
   * Play a tone with the given parameters.
   */
  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      waveType: OscillatorType,
      startTime: number,
      ctx: AudioContext,
      gain: number = 0.3
    ) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = waveType;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(gain, startTime);
      // Exponential ramp to near-zero to avoid audio clicks/pops
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    },
    []
  );

  /**
   * Play success chime: two ascending sine tones (C5 → E5).
   * C5 = 523 Hz for 150ms, then E5 = 659 Hz for 150ms.
   */
  const playSuccess = useCallback(() => {
    if (isMuted) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    // Ensure context is running
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Note 1: C5 (523 Hz) — sine wave, 150ms
    playTone(523, 0.15, "sine", now, ctx, 0.3);
    // Note 2: E5 (659 Hz) — sine wave, 150ms (starts after first note)
    playTone(659, 0.15, "sine", now + 0.15, ctx, 0.3);
  }, [isMuted, getAudioContext, playTone]);

  /**
   * Play error tone: two descending triangle tones (E4 → C4).
   * E4 = 329 Hz for 150ms, then C4 = 261 Hz for 200ms.
   */
  const playError = useCallback(() => {
    if (isMuted) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    // Ensure context is running
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Note 1: E4 (329 Hz) — triangle wave, 150ms
    playTone(329, 0.15, "triangle", now, ctx, 0.3);
    // Note 2: C4 (261 Hz) — triangle wave, 200ms (starts after first note)
    playTone(261, 0.2, "triangle", now + 0.15, ctx, 0.3);
  }, [isMuted, getAudioContext, playTone]);

  /**
   * Toggle mute state and persist to localStorage.
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      try {
        // Store sound enabled state: "true" = sound on, "false" = sound off (muted)
        localStorage.setItem(STORAGE_KEY, newMuted ? "false" : "true");
      } catch {
        // localStorage may not be available
      }
      return newMuted;
    });
  }, []);

  return {
    playSuccess,
    playError,
    isMuted,
    toggleMute,
  };
}
