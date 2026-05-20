"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { cachedFetch } from "@/lib/client-cache";
import { cn } from "@/lib/utils";
import ActivityFeedItem, { type ActivityEvent } from "./ActivityFeedItem";
import ActivityFeedEmpty from "./ActivityFeedEmpty";

const POLL_INTERVAL = 10_000; // 10 seconds
const TIMESTAMP_REFRESH_INTERVAL = 30_000; // 30 seconds
const SCROLL_THRESHOLD = 40; // pixels from bottom to consider "at bottom"

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(0);

  // Fetch events from API
  const fetchEvents = useCallback(async (initial = false) => {
    try {
      const data = await cachedFetch<ActivityEvent[]>("/api/events", {
        forceRefresh: !initial,
      });
      if (Array.isArray(data)) {
        setEvents(data);
      }
    } catch {
      // Silently fail on poll errors; keep existing data
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  // Polling interval
  useEffect(() => {
    const interval = setInterval(() => fetchEvents(false), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Timestamp refresh interval (force re-render every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, TIMESTAMP_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (autoScroll && events.length > prevEventCountRef.current) {
      scrollToBottom();
    }
    prevEventCountRef.current = events.length;
  }, [events, autoScroll]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Handle scroll — detect if user scrolled away from bottom
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
    setAutoScroll(isAtBottom);
  };

  // Re-enable auto-scroll
  const handleResumeAutoScroll = () => {
    setAutoScroll(true);
    scrollToBottom();
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
          Activity Feed
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
              <div className="w-7 h-7 rounded-md bg-surface-3" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-surface-3 rounded w-3/4" />
                <div className="h-2.5 bg-surface-3 rounded w-1/3" />
              </div>
              <div className="h-3 bg-surface-3 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Activity Feed
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {events.length === 0 ? (
        <ActivityFeedEmpty />
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[400px] overflow-y-auto scrollbar-thin"
            role="log"
            aria-live="polite"
            aria-label="Activity feed"
          >
            <ul className="space-y-0.5">
              {events.map((event) => (
                <ActivityFeedItem key={event.id} event={event} />
              ))}
            </ul>
          </div>

          {/* Scroll-to-bottom toggle */}
          {!autoScroll && (
            <button
              onClick={handleResumeAutoScroll}
              className={cn(
                "absolute bottom-3 right-3 z-10",
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
                "bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium",
                "shadow-lg transition-all",
                "animate-in fade-in slide-in-from-bottom-2"
              )}
              aria-label="Scroll to latest events"
            >
              <ArrowDown className="w-3 h-3" />
              New events
            </button>
          )}
        </div>
      )}
    </div>
  );
}
