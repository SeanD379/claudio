"use client";

import { create } from "zustand";

export type ModuleId = "home" | "calendar" | "daily" | "mood" | "concert";

interface NavigationState {
  // 来源模块（用户从哪个模块进入播放器）
  sourceModule: ModuleId | null;

  // 设置来源模块
  setSourceModule: (module: ModuleId | null) => void;

  // 获取来源模块并清除
  popSourceModule: () => ModuleId | null;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  sourceModule: null,

  setSourceModule: (module: ModuleId | null) => {
    set({ sourceModule: module });
  },

  popSourceModule: () => {
    const { sourceModule } = get();
    set({ sourceModule: null });
    return sourceModule;
  },
}));
