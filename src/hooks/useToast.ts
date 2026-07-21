import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
}

let nextId = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "success") => {
    const id = nextId++;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // 3 秒后自动移除
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
