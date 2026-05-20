"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar/SidebarContext";

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}
    >
      {children}
    </div>
  );
}
