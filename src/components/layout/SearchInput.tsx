"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Bot, GitPullRequest, History, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: "agents" | "workflows" | "tickets";
  href: string;
}

const MOCK_DATA: SearchItem[] = [
  // Agents
  {
    id: "agent-1",
    title: "Customer Support Agent",
    subtitle: "Handles customer inquiries and support tickets",
    category: "agents",
    href: "/agents/agent-1",
  },
  {
    id: "agent-2",
    title: "Data Pipeline Agent",
    subtitle: "Processes and transforms data streams",
    category: "agents",
    href: "/agents/agent-2",
  },
  {
    id: "agent-3",
    title: "Security Scanner",
    subtitle: "Monitors for security vulnerabilities",
    category: "agents",
    href: "/agents/agent-3",
  },
  {
    id: "agent-4",
    title: "Code Review Agent",
    subtitle: "Automated code review and suggestions",
    category: "agents",
    href: "/agents/agent-4",
  },
  // Workflows
  {
    id: "workflow-1",
    title: "Order Processing",
    subtitle: "End-to-end order fulfillment workflow",
    category: "workflows",
    href: "/workflow",
  },
  {
    id: "workflow-2",
    title: "User Onboarding",
    subtitle: "New user registration and setup flow",
    category: "workflows",
    href: "/workflow",
  },
  {
    id: "workflow-3",
    title: "Incident Response",
    subtitle: "Automated incident detection and escalation",
    category: "workflows",
    href: "/workflow",
  },
  {
    id: "workflow-4",
    title: "Data Sync Pipeline",
    subtitle: "Cross-system data synchronization",
    category: "workflows",
    href: "/workflow",
  },
  // Tickets
  {
    id: "ticket-1",
    title: "TICKET-001: Deploy agent to prod",
    subtitle: "Pending deployment approval",
    category: "tickets",
    href: "/tickets",
  },
  {
    id: "ticket-2",
    title: "TICKET-002: Fix timeout issue",
    subtitle: "Agent response timeout after 30s",
    category: "tickets",
    href: "/tickets",
  },
  {
    id: "ticket-3",
    title: "TICKET-003: Add monitoring dashboard",
    subtitle: "Create observability views for agents",
    category: "tickets",
    href: "/tickets",
  },
  {
    id: "ticket-4",
    title: "TICKET-004: Update security policies",
    subtitle: "Review and update IAM permissions",
    category: "tickets",
    href: "/tickets",
  },
];

const CATEGORY_CONFIG = {
  agents: { label: "Agents", Icon: Bot },
  workflows: { label: "Workflows", Icon: GitPullRequest },
  tickets: { label: "Tickets", Icon: History },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

export default function SearchInput() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce logic
  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Filter results based on debounced query
  const filteredResults = debouncedQuery.length >= 2
    ? MOCK_DATA.filter(
        (item) =>
          item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : [];

  // Group results by category
  const groupedResults = (Object.keys(CATEGORY_CONFIG) as Category[]).reduce(
    (acc, category) => {
      const items = filteredResults.filter((item) => item.category === category);
      if (items.length > 0) {
        acc.push({ category, items });
      }
      return acc;
    },
    [] as { category: Category; items: SearchItem[] }[]
  );

  // Flat list of items for keyboard navigation
  const flatItems = groupedResults.flatMap((group) => group.items);

  // Determine if dropdown should show
  const showDropdown = isFocused && query.length >= 2;

  // Click outside handler
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((prev) =>
            prev < flatItems.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          event.preventDefault();
          if (activeIndex >= 0 && activeIndex < flatItems.length) {
            const selectedItem = flatItems[activeIndex];
            if (selectedItem) {
              window.location.href = selectedItem.href;
            }
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsFocused(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, flatItems, activeIndex]
  );

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  const activeItemId =
    activeIndex >= 0 && flatItems[activeIndex]
      ? `search-option-${flatItems[activeIndex].id}`
      : undefined;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md mx-4">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          aria-label="Search agents, workflows, and tickets"
          aria-activedescendant={activeItemId}
          aria-expanded={showDropdown}
          aria-controls="search-results-listbox"
          role="combobox"
          aria-autocomplete="list"
          className={cn(
            "w-full pl-9 pr-9 py-2 text-sm rounded-lg",
            "bg-surface-2 border border-surface-4",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30",
            "focus:outline-none transition-colors"
          )}
        />
        {isLoading && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-brand-400"
            aria-hidden="true"
          />
        )}
      </div>

      {showDropdown && (
        <div
          id="search-results-listbox"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 right-0 mt-2 bg-surface-2 border border-surface-4 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2
                className="animate-spin w-4 h-4 text-brand-400"
                aria-hidden="true"
              />
              <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                Searching...
              </span>
            </div>
          ) : filteredResults.length === 0 && debouncedQuery.length >= 2 ? (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-4">
              No results found for &apos;{debouncedQuery}&apos;
            </div>
          ) : (
            groupedResults.map((group) => {
              const { label, Icon } = CATEGORY_CONFIG[group.category];
              return (
                <div key={group.category}>
                  <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                    {label}
                  </div>
                  {group.items.map((item) => {
                    const itemIndex = flatItems.indexOf(item);
                    const isActive = itemIndex === activeIndex;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        id={`search-option-${item.id}`}
                        role="option"
                        aria-selected={isActive}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 cursor-pointer",
                          "hover:bg-surface-3 transition-colors",
                          isActive && "bg-surface-3"
                        )}
                        onClick={() => {
                          setIsFocused(false);
                          setQuery("");
                          setActiveIndex(-1);
                        }}
                      >
                        <Icon
                          className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-[var(--color-text-primary)] truncate">
                            {item.title}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
