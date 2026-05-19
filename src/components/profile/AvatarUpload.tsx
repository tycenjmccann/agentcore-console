"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, X, Loader2, User } from "lucide-react";
import imageCompression from 'browser-image-compression';

export default function AvatarUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCurrentAvatar();
  }, []);

  const fetchCurrentAvatar = async () => {
    try {
      const res = await fetch('/api/profile/avatar');
      if (res.ok) {
        const data = await res.json();
        setCurrentAvatar(data.avatarUrl);
      }
    } catch (error) {
      console.error('Failed to fetch avatar:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(selectedFile.type)) {
      setError('Only JPEG and PNG files are supported');
      return;
    }

    // Validate file size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB');
      return;
    }

    setError(null);
    setFile(selectedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 512,
        useWebWorker: true
      };
      
      const compressed = await imageCompression(file, options);
      
      // Upload via FormData
      const formData = new FormData();
      formData.append('file', compressed);
      
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      
      const data = await res.json();
      setCurrentAvatar(data.avatarUrl);
      localStorage.setItem('user-avatar-url', data.avatarUrl);
      
      // Trigger header update
      window.dispatchEvent(new Event('avatar-updated'));
      
      // Success feedback
      setSuccess(true);
      setFile(null);
      setPreview(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentAvatar) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error('Failed to remove avatar');
      }
      
      setCurrentAvatar(null);
      localStorage.removeItem('user-avatar-url');
      
      // Trigger header update
      window.dispatchEvent(new Event('avatar-updated'));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        {/* Avatar Preview */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-full bg-surface-2 border-2 border-surface-4 overflow-hidden flex items-center justify-center">
            {preview || currentAvatar ? (
              <img 
                src={preview || currentAvatar || ''} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-[var(--color-text-muted)]" />
            )}
          </div>
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Profile Picture
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Upload a profile picture (JPEG or PNG, max 5MB)
            </p>
          </div>

          {!preview ? (
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Choose File
              </label>
              
              {currentAvatar && (
                <button
                  onClick={handleRemove}
                  disabled={uploading}
                  className="px-4 py-2 bg-surface-3 hover:bg-surface-4 text-[var(--color-text-secondary)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
              
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="px-4 py-2 bg-surface-3 hover:bg-surface-4 text-[var(--color-text-secondary)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">
            {currentAvatar ? 'Avatar uploaded successfully!' : 'Avatar removed successfully!'}
          </p>
        </div>
      )}
    </div>
  );
}
