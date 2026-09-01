"use client";

import { create } from "zustand";

export type AppMode = "listen" | "concert";

interface ModeState {
  mode: AppMode;
  showHall: boolean;
  setMode: (mode: AppMode) => void;
  setShowHall: (show: boolean) => void;
}

export const useMode = create<ModeState>((set) => ({
  mode: "listen",
  showHall: true,
  setMode: (mode) => {
    set({ mode });
    try { localStorage.setItem("claudio-mode", mode); } catch {}
  },
  setShowHall: (show) => {
    set({ showHall: show });
  },
}));

// Call once from a client component (e.g. ThemeProvider) after mount
export function restoreMode(): void {
  try {
    const saved = localStorage.getItem("claudio-mode");
    if (saved === "listen" || saved === "concert" || saved === "ktv") {
      const mode = saved === "ktv" ? "concert" : saved;
      useMode.setState({ mode, showHall: mode === "listen" });
    }
  } catch {}
}
