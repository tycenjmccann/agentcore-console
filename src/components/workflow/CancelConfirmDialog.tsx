"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface CancelConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

export default function CancelConfirmDialog({
  isOpen,
  onConfirm,
  onDismiss,
}: CancelConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Dialog */}
      <div className="relative bg-[#1a2332] border border-[#2d3748] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mb-4 mx-auto">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-[#e2e8f0] text-center mb-2">
          Cancel this workflow?
        </h3>
        <p className="text-sm text-[#94a3b8] text-center mb-6">
          Running agents will be stopped. This action cannot be undone.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[#e2e8f0] bg-[#2d3748] hover:bg-[#374151] border border-[#4b5563] rounded-lg transition-colors disabled:opacity-50"
          >
            Keep Running
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Workflow"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
