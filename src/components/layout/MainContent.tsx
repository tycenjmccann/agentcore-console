"use client";

import { cn } from "@/lib/utils";
import { useSidebarContext } from "@/components/layout/sidebar/SidebarContext";
import Header from "@/components/layout/Header";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarContext();

  return (
    <div className={cn("flex-1 transition-all duration-300", isCollapsed ? "ml-16" : "ml-64")}>
      <Header />
      <main className="p-6">{children}</main>
    </div>
  );
}
