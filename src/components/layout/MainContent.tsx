"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  useEffect(() => {
    // Listen for sidebar state changes via DOM attribute
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-sidebar-collapsed"
        ) {
          const value =
            document.documentElement.getAttribute("data-sidebar-collapsed");
          setCollapsed(value === "true");
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sidebar-collapsed"],
    });

    // Sync initial state from DOM attribute (set by inline script)
    const initialValue =
      document.documentElement.getAttribute("data-sidebar-collapsed");
    if (initialValue === "true") {
      setCollapsed(true);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "flex-1 transition-[margin-left] duration-300 ease-in-out overflow-hidden",
        collapsed ? "ml-16" : "ml-64"
      )}
    >
      {children}
    </div>
  );
}
