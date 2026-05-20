'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  collapsed: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggleSidebar: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem('sidebar-collapsed', String(newValue));
      return newValue;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
