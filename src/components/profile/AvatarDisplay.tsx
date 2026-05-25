"use client";

import { User } from "lucide-react";
import clsx from "clsx";

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-pink-500",
  "bg-fuchsia-500",
  "bg-purple-500",
  "bg-violet-500",
  "bg-indigo-500",
  "bg-blue-500",
  "bg-sky-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-orange-500",
];

const SIZE_CLASSES = {
  32: "w-8 h-8 text-xs",
  48: "w-12 h-12 text-sm",
  64: "w-16 h-16 text-base",
  128: "w-32 h-32 text-2xl",
} as const;

const ICON_SIZES = {
  32: 14,
  48: 18,
  64: 24,
  128: 40,
} as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || "").toUpperCase();
}

function getColorIndex(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash += identifier.charCodeAt(i);
  }
  return hash % AVATAR_COLORS.length;
}

export interface AvatarDisplayProps {
  src?: string | null;
  name?: string;
  userId?: string;
  size?: 32 | 48 | 64 | 128;
  className?: string;
  onClick?: () => void;
}

export default function AvatarDisplay({
  src,
  name,
  userId,
  size = 48,
  className,
  onClick,
}: AvatarDisplayProps) {
  const sizeClass = SIZE_CLASSES[size];
  const identifier = userId || name || "user";
  const colorClass = AVATAR_COLORS[getColorIndex(identifier)];
  const altText = name ? `${name}'s avatar` : "User avatar";

  const containerClasses = clsx(
    "rounded-full overflow-hidden flex items-center justify-center flex-shrink-0",
    sizeClass,
    !src && colorClass,
    onClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-[var(--color-surface-0)] transition-all hover:opacity-90",
    className
  );

  const content = src ? (
    <img
      src={src}
      alt={altText}
      className="w-full h-full object-cover"
    />
  ) : name ? (
    <span className="font-semibold text-white select-none">
      {getInitials(name)}
    </span>
  ) : (
    <User className="text-white" size={ICON_SIZES[size]} />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={containerClasses}
        aria-label={`Change ${altText}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={containerClasses} role="img" aria-label={altText}>
      {content}
    </div>
  );
}
