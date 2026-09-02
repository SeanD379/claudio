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
  returnPath: string | null;
  setReturnPath: (path: string | null) => void;
  popReturnPath: () => string | null;
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

  returnPath: null,
  setReturnPath: (path) => set({ returnPath: path }),
  popReturnPath: () => {
    const { returnPath } = get();
    set({ returnPath: null });
    return returnPath;
  },
}));
