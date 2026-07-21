"use client";

import { create } from "zustand";
import type { MoodType } from "@/hooks/useAudioAnalyzer";

interface MoodLockState {
  // null = 自动，具体值 = 锁定到该 mood
  lockedMood: MoodType | null;
  // 锁定到指定 mood（如果已锁定同一 mood 则解锁）
  toggleLock: (mood: MoodType) => void;
  // 解锁，恢复自动
  unlock: () => void;
}

export const useMoodLock = create<MoodLockState>((set, get) => ({
  lockedMood: null,

  toggleLock: (mood: MoodType) => {
    const current = get().lockedMood;
    if (current === mood) {
      // 已锁定同一 mood → 解锁
      set({ lockedMood: null });
    } else {
      // 锁定新 mood
      set({ lockedMood: mood });
    }
  },

  unlock: () => set({ lockedMood: null }),
}));
