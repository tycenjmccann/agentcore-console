"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { cachedFetch } from "@/lib/client-cache";
import { cn } from "@/lib/utils";
import ActivityFeedItem, { type ActivityEvent } from "./ActivityFeedItem";
import ActivityFeedEmpty from "./ActivityFeedEmpty";

const EVENTS_URL = "/api/events";
const POLL_INTERVAL = 10_000; // 10 seconds
const TIMESTAMP_REFRESH_INTERVAL = 30_000; // 30 seconds

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [, setTick] = useState(0); // Force re-render for timestamp updates

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async (initial = false) => {
    try {
      const data = await cachedFetch<ActivityEvent[]>(EVENTS_URL, {
        forceRefresh: !initial,
      });
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      // Silently handle fetch errors — keep existing events
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
    const interval = setInterval(() => {
      fetchEvents(false);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Timestamp refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, TIMESTAMP_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (autoScroll && !loading) {
      scrollToBottom();
    }
  }, [events, autoScroll, loading, scrollToBottom]);

  // Handle scroll events to detect user scrolling up
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;

    if (isAtBottom) {
      setAutoScroll(true);
      isUserScrolling.current = false;
    } else {
      setAutoScroll(false);
      isUserScrolling.current = true;
    }
  }, []);

  // Re-enable auto-scroll
  const handleScrollToBottom = useCallback(() => {
    setAutoScroll(true);
    scrollToBottom();
  }, [scrollToBottom]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="card">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
          Activity Feed
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-4 h-4 rounded-full bg-surface-3 mt-0.5" />
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
        {events.length > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <ActivityFeedEmpty />
      ) : (
        <div className="relative">
          {/* Scrollable event list */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="max-h-80 overflow-y-auto pr-1 scroll-smooth"
            role="log"
            aria-live="polite"
            aria-label="Activity feed"
          >
            <ul className="space-y-2">
              {events.map((event) => (
                <ActivityFeedItem key={event.id} event={event} />
              ))}
            </ul>
          </div>

          {/* Scroll-to-bottom toggle */}
          {!autoScroll && (
            <button
              onClick={handleScrollToBottom}
              className={cn(
                "absolute bottom-2 right-2 flex items-center gap-1.5",
                "px-2.5 py-1.5 rounded-lg",
                "bg-surface-3 border border-surface-4",
                "text-xs text-[var(--color-text-secondary)]",
                "hover:bg-surface-4 hover:text-[var(--color-text-primary)]",
                "transition-all shadow-lg"
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
