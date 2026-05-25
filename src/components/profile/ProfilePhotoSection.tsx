"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";
import PhotoUploadModal from "./PhotoUploadModal";

export interface ProfilePhotoSectionProps {
  avatarUrl?: string | null;
  userName?: string;
  userId?: string;
  onAvatarChange?: (newUrl: string) => void;
}

export default function ProfilePhotoSection({
  avatarUrl,
  userName,
  userId,
  onAvatarChange,
}: ProfilePhotoSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);

  const handleUploadComplete = (newUrl: string) => {
    setCurrentAvatarUrl(newUrl);
    onAvatarChange?.(newUrl);
  };

  const handleRemovePhoto = async () => {
    try {
      const res = await fetch("/api/profile/photo", {
        method: "DELETE",
      });
      if (res.ok) {
        setCurrentAvatarUrl(null);
        onAvatarChange?.("");
      }
    } catch {
      // Silently fail — toast could be added here
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="relative">
          <AvatarDisplay
            src={currentAvatarUrl}
            name={userName}
            userId={userId}
            size={128}
            onClick={() => setIsModalOpen(true)}
          />
          <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-lg border-2 border-[var(--color-surface-1)] pointer-events-none">
            <Camera size={14} className="text-white" />
          </div>
        </div>

        {/* Info & Actions */}
        <div className="flex flex-col items-center sm:items-start gap-3">
          {userName && (
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {userName}
            </h3>
          )}
          <p className="text-sm text-[var(--color-text-muted)]">
            Upload a photo to personalize your profile
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors"
            >
              Change photo
            </button>
            {currentAvatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-4 py-2 rounded-lg border border-surface-4 text-[var(--color-text-secondary)] hover:bg-surface-2 font-medium text-sm transition-colors"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      <PhotoUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUploadComplete={handleUploadComplete}
        currentAvatarUrl={currentAvatarUrl}
      />
    </>
  );
}
