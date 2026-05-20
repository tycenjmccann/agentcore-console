"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Bot,
  Hammer,
  GitPullRequest,
  Workflow,
  History,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  keywords?: string[];
  shortcut?: string[];
  category: "navigation" | "action" | "search";
}

interface FuzzyResult {
  item: CommandItem;
  score: number;
}

const RECENT_STORAGE_KEY = "command-palette-recent";
const MAX_RECENT_ITEMS = 5;

function fuzzyMatch(query: string, target: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  if (lowerQuery.length === 0) return 0;
  if (lowerQuery.length > lowerTarget.length) return -1;

  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;

  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      score += 1;

      // Consecutive match bonus
      if (lastMatchIndex === i - 1) {
        consecutiveBonus += 2;
        score += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }

      // Word boundary bonus
      if (i === 0 || lowerTarget[i - 1] === " " || lowerTarget[i - 1] === "-" || lowerTarget[i - 1] === "/") {
        score += 3;
      }

      // Penalty for distance between matches
      if (lastMatchIndex >= 0) {
        const gap = i - lastMatchIndex - 1;
        score -= gap * 0.5;
      }

      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // All characters must match
  if (queryIndex !== lowerQuery.length) return -1;

  // Normalize by query length for fair comparison
  return score / lowerQuery.length;
}

function matchCommand(query: string, item: CommandItem): number {
  const titleScore = fuzzyMatch(query, item.title);
  const descScore = item.description ? fuzzyMatch(query, item.description) * 0.7 : -1;
  const keywordScores = (item.keywords || []).map((kw) => fuzzyMatch(query, kw) * 0.8);

  return Math.max(titleScore, descScore, ...keywordScores);
}

function getRecentItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT_ITEMS);
    }
  } catch {
    // Ignore localStorage errors
  }
  return [];
}

function saveRecentItem(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentItems().filter((item) => item !== id);
    recent.unshift(id);
    localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_ITEMS))
    );
  } catch {
    // Ignore localStorage errors
  }
}

export function useCommandPalette(onNavigate: (path: string) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    {
      id: "nav-dashboard",
      title: "Dashboard",
      description: "Go to Dashboard",
      icon: LayoutDashboard,
      action: () => onNavigate("/"),
      keywords: ["home", "main", "overview"],
      shortcut: ["G", "D"],
      category: "navigation",
    },
    {
      id: "nav-agents",
      title: "Agents",
      description: "Go to Agents",
      icon: Bot,
      action: () => onNavigate("/agents"),
      keywords: ["bot", "ai", "assistant"],
      shortcut: ["G", "A"],
      category: "navigation",
    },
    {
      id: "nav-build",
      title: "Build",
      description: "Go to Build",
      icon: Hammer,
      action: () => onNavigate("/build"),
      keywords: ["create", "construct", "develop"],
      shortcut: ["G", "B"],
      category: "navigation",
    },
    {
      id: "nav-workflow",
      title: "Workflow",
      description: "Go to Workflow",
      icon: GitPullRequest,
      action: () => onNavigate("/workflow"),
      keywords: ["flow", "pipeline", "process"],
      shortcut: ["G", "W"],
      category: "navigation",
    },
    {
      id: "nav-routing",
      title: "Routing",
      description: "Go to Routing",
      icon: Workflow,
      action: () => onNavigate("/routing"),
      keywords: ["route", "path", "direct"],
      shortcut: ["G", "R"],
      category: "navigation",
    },
    {
      id: "nav-tickets",
      title: "Ticket History",
      description: "Go to Ticket History",
      icon: History,
      action: () => onNavigate("/tickets"),
      keywords: ["tickets", "history", "log", "issues"],
      shortcut: ["G", "T"],
      category: "navigation",
    },
    {
      id: "action-new-workflow",
      title: "New Workflow",
      description: "Create a new workflow",
      icon: Plus,
      action: () => onNavigate("/workflow"),
      keywords: ["create", "add", "new", "workflow"],
      category: "action",
    },
  ];

  const getResults = useCallback((): CommandItem[] => {
    if (!query.trim()) {
      // Show recent items when query is empty
      const recentIds = getRecentItems();
      const recentCommands = recentIds
        .map((id) => commands.find((cmd) => cmd.id === id))
        .filter((cmd): cmd is CommandItem => cmd !== undefined);

      if (recentCommands.length > 0) return recentCommands;
      return commands;
    }

    const scored: FuzzyResult[] = commands
      .map((item) => ({ item, score: matchCommand(query, item) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((r) => r.item);
  }, [query]);

  const results = getResults();

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const executeCommand = useCallback(
    (item: CommandItem) => {
      saveRecentItem(item.id);
      close();
      item.action();
    },
    [close]
  );

  const executeActiveCommand = useCallback(() => {
    if (results.length > 0 && activeIndex >= 0 && activeIndex < results.length) {
      executeCommand(results[activeIndex]);
    }
  }, [results, activeIndex, executeCommand]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, open, close]);

  // Palette-specific keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev < results.length - 1 ? prev + 1 : 0;
            scrollToIndex(next);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev > 0 ? prev - 1 : results.length - 1;
            scrollToIndex(next);
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          executeActiveCommand();
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results.length, executeActiveCommand, close]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function scrollToIndex(index: number) {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: "nearest" });
    }
  }

  return {
    isOpen,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    results,
    open,
    close,
    executeCommand,
    listRef,
    hasRecentItems: !query.trim() && getRecentItems().length > 0,
  };
}
