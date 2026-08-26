"use client";

import { create } from "zustand";

interface ThemeState {
  theme: "light" | "dark";
  language: "zh" | "en";
  narrationEnabled: boolean;
  autoPlay: boolean;
  quickSwitch: boolean;
  dynamicBg: boolean;
  isLoading: boolean;

  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (lang: "zh" | "en") => void;
  setNarrationEnabled: (enabled: boolean) => void;
  setAutoPlay: (enabled: boolean) => void;
  setQuickSwitch: (enabled: boolean) => void;
  setDynamicBg: (enabled: boolean) => void;
  toggleTheme: () => void;
  fetchSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "light",
  language: "zh",
  narrationEnabled: false,
  autoPlay: false,
  quickSwitch: false,
  dynamicBg: true,
  isLoading: false,

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  },

  setLanguage: (language) => {
    set({ language });
    document.documentElement.lang = language;
  },

  setNarrationEnabled: (narrationEnabled) => {
    set({ narrationEnabled });
  },

  setAutoPlay: (autoPlay) => {
    set({ autoPlay });
  },

  setQuickSwitch: (quickSwitch) => {
    set({ quickSwitch });
  },

  setDynamicBg: (dynamicBg) => {
    set({ dynamicBg });
  },

  toggleTheme: () => {
    const { theme, setTheme } = get();
    setTheme(theme === "light" ? "dark" : "light");
  },

  fetchSettings: async () => {
    // 优先从 localStorage 缓存读取，立即应用
    try {
      const cached = localStorage.getItem("claudio-settings");
      if (cached) {
        const data = JSON.parse(cached);
        set({ ...data, isLoading: false });
        document.documentElement.setAttribute("data-theme", data.theme === "light" ? "light" : "dark");
        document.documentElement.lang = data.language;
        document.documentElement.style.setProperty("--text-scale", "1"); // 固定中号字体
      }
    } catch {}

    // 后台从服务器获取最新设置
    try {
      const response = await fetch("/api/user/settings");
      if (response.ok) {
        const data = await response.json();
        const { theme, language, narrationEnabled, autoPlay, quickSwitch, dynamicBg } = data;
        const settings = { theme, language, narrationEnabled, autoPlay, quickSwitch, dynamicBg };
        set({ ...settings, isLoading: false });

        // 更新缓存
        try { localStorage.setItem("claudio-settings", JSON.stringify(settings)); } catch {}

        document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
        document.documentElement.lang = language;
        document.documentElement.style.setProperty("--text-scale", "1"); // 固定中号字体
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      set({ isLoading: false });
    }
  },

  saveSettings: async () => {
    const { theme, language, narrationEnabled, autoPlay, quickSwitch, dynamicBg } = get();
    const settings = { theme, language, narrationEnabled, autoPlay, quickSwitch, dynamicBg };
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      // Only update cache if server accepted the save
      if (res.ok) {
        try { localStorage.setItem("claudio-settings", JSON.stringify(settings)); } catch {}
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  },
}));
