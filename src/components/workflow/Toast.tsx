"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type,
  isVisible,
  onClose,
  duration = 4000,
}: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Small delay for enter animation
      requestAnimationFrame(() => setShow(true));
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const bgColor = type === "success" ? "bg-green-600/90" : "bg-red-600/90";
  const Icon = type === "success" ? CheckCircle : XCircle;

  return (
    <div className="fixed top-4 right-4 z-[100]">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border border-white/10 backdrop-blur-sm transition-all duration-300 ${bgColor} ${
          show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <Icon className="w-5 h-5 text-white flex-shrink-0" />
        <span className="text-sm font-medium text-white">{message}</span>
        <button
          onClick={() => {
            setShow(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
