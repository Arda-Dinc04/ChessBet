"use client";

import { useEffect, useState } from "react";

interface NotificationProps {
  message: string;
  type: "error" | "success" | "info";
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Notification({ 
  message, 
  type, 
  isVisible, 
  onClose, 
  duration = 3000 
}: NotificationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible && !isAnimating) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "error":
        return "bg-red-500/90 border-red-400 text-white";
      case "success":
        return "bg-emerald-500/90 border-emerald-400 text-white";
      case "info":
        return "bg-blue-500/90 border-blue-400 text-white";
      default:
        return "bg-slate-500/90 border-slate-400 text-white";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "error":
        return "⚠️";
      case "success":
        return "✅";
      case "info":
        return "ℹ️";
      default:
        return "📢";
    }
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg border backdrop-blur-sm
        transform transition-all duration-300 ease-in-out
        ${getTypeStyles()}
        ${isVisible && isAnimating 
          ? "translate-x-0 opacity-100 scale-100" 
          : "translate-x-full opacity-0 scale-95"
        }
        shadow-lg
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="text-lg flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-5">
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-2 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

