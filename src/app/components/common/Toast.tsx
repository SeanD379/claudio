"use client";

import { useToast } from "@/hooks/useToast";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const icons: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const iconColors: Record<string, string> = {
  success: "text-green-500",
  error: "text-accent",
  info: "text-accent",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-sm bg-surface border-border-custom shadow-lg"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${iconColors[toast.type]}`} />
              <span className="text-sm font-medium text-text-primary">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-1 p-0.5 rounded hover:bg-surface-elevated transition-colors"
              >
                <X className="w-3.5 h-3.5 text-text-muted" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
