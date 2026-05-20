"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * Non-intrusive banner that prompts users to enable browser notifications.
 *
 * Visibility rules:
 * - Only shows when Notification.permission === 'default'
 * - Hidden if user previously dismissed the banner
 * - Hidden if permission was already granted or denied
 * - Hidden if browser doesn't support Notifications API
 */
export default function NotificationBanner() {
  const { shouldShowBanner, requestPermission, dismiss } = useNotifications();
  const [isVisible, setIsVisible] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  // Don't render if conditions aren't met
  if (!shouldShowBanner || !isVisible) {
    return null;
  }

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      await requestPermission();
    } finally {
      setIsRequesting(false);
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    dismiss();
    setIsVisible(false);
  };

  return (
    <div className="mx-4 mt-4 mb-2 flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-600/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Icon */}
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10">
        <Bell className="w-4 h-4 text-blue-400" />
      </div>

      {/* Message */}
      <p className="flex-1 text-sm text-[var(--color-text-secondary)]">
        Enable notifications to know when workflows complete
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={isRequesting}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRequesting ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Dismiss"
          aria-label="Dismiss notification banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
