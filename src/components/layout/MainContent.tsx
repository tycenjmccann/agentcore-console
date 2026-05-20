'use client';

import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/layout/sidebar/SidebarContext';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className={cn('flex-1 transition-all duration-300', collapsed ? 'ml-16' : 'ml-64')}>
      {children}
    </div>
  );
}
