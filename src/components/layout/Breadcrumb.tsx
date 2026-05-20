"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { cn, truncate } from "@/lib/utils";

function formatSegment(segment: string): string {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Breadcrumb() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="px-6 py-2 bg-surface-1">
      <ol className="flex items-center gap-1.5">
        {/* Home icon */}
        <li className="flex items-center">
          <Link
            href="/"
            className="text-[var(--color-text-secondary)] hover:text-brand-400 transition-colors"
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>

        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          const label = formatSegment(segment);
          const displayLabel = truncate(label, 20);

          return (
            <li key={href} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-sm font-medium text-[var(--color-text-primary)]"
                >
                  {displayLabel}
                </span>
              ) : (
                <Link
                  href={href}
                  className="text-sm text-[var(--color-text-secondary)] hover:text-brand-400 transition-colors"
                >
                  {displayLabel}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
