"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Upload, ImageIcon, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import clsx from "clsx";
import { getCroppedImg } from "@/lib/crop-utils";
import { useToast } from "@/components/ui/Toast";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (newAvatarUrl: string) => void;
  currentAvatarUrl?: string | null;
}

export default function PhotoUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  currentAvatarUrl,
}: PhotoUploadModalProps) {
  const [step, setStep] = useState<"select" | "crop">("select");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("select");
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setIsUploading(false);
      setError(null);
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl?.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus first element
    setTimeout(() => firstFocusRef.current?.focus(), 50);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Unsupported file type. Please use JPEG, PNG, WebP, or HEIC.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File is too large. Maximum size is 10MB.";
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setStep("crop");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsUploading(true);
    setError(null);

    try {
      // Crop the image
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

      // Get presigned URL
      const presignRes = await fetch("/api/profile/photo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "image/webp",
          fileName: "avatar.webp",
        }),
      });

      if (!presignRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, key } = await presignRes.json();

      // Upload to presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: croppedBlob,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      // Confirm upload
      const confirmRes = await fetch("/api/profile/photo/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (!confirmRes.ok) {
        throw new Error("Failed to confirm upload");
      }

      const { avatarUrl } = await confirmRes.json();
      showToast("Photo updated successfully!", "success");
      onUploadComplete(avatarUrl);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-upload-title"
        className="bg-surface-1 rounded-xl shadow-xl border border-surface-4 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-4">
          <h2
            id="photo-upload-title"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            {step === "select" ? "Upload Photo" : "Crop Photo"}
          </h2>
          <button
            ref={firstFocusRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors text-[var(--color-text-muted)]"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "select" && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                  isDragging
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-surface-4 hover:border-brand-500/50 hover:bg-surface-2"
                )}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Drop zone for photo upload. Click or drag and drop an image."
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center">
                    <ImageIcon size={24} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Drop your photo here or click to browse
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      JPEG, PNG, WebP, or HEIC • Max 10MB
                    </p>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors"
              >
                <Upload size={16} />
                Browse Files
              </button>

              {error && (
                <p className="text-sm text-red-400 text-center" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          {step === "crop" && imageSrc && (
            <div className="space-y-4">
              {/* Crop area */}
              <div className="relative w-full h-64 sm:h-80 rounded-lg overflow-hidden bg-surface-0">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              {/* Zoom control */}
              <div className="flex items-center gap-3 px-2">
                <ZoomOut size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-surface-3 accent-brand-500"
                  aria-label="Zoom level"
                />
                <ZoomIn size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center" role="alert">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep("select");
                    setImageSrc(null);
                    setError(null);
                  }}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-surface-4 text-[var(--color-text-secondary)] hover:bg-surface-2 font-medium text-sm transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
