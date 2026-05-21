"use client";

import { useEffect, useState } from "react";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  useEffect(() => {
    // Listen for sidebar state changes via the data attribute
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-sidebar-collapsed"
        ) {
          const value = document.documentElement.getAttribute("data-sidebar-collapsed");
          setCollapsed(value === "true");
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sidebar-collapsed"],
    });

    // Sync initial state
    const value = document.documentElement.getAttribute("data-sidebar-collapsed");
    if (value !== null) {
      setCollapsed(value === "true");
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex-1 transition-[margin-left] duration-300 ease-in-out"
      style={{ marginLeft: collapsed ? "4rem" : "16rem" }}
    >
      {children}
    </div>
  );
}
