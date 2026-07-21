"use client";

import { create } from "zustand";
import { usePlayer, canAutoPlay } from "./usePlayer";

let ttsAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function getTTSAudio(): HTMLAudioElement {
  if (!ttsAudio) {
    ttsAudio = new Audio();
    ttsAudio.preload = "auto";
  }
  return ttsAudio;
}

function revokeCurrentUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  enabled: boolean;
  currentMessageId: string | null;
  toggle: () => void;
  speak: (text: string, language: "zh" | "en", messageId?: string) => Promise<void>;
  speakAndWait: (text: string, language: "zh" | "en") => Promise<void>;
  speakAndWaitWithAudio: (audioUrl: string) => Promise<void>;
  stop: () => void;
}

export const useTTS = create<TTSState>((set, get) => ({
  isPlaying: false,
  isLoading: false,
  enabled: true,
  currentMessageId: null,

  toggle: () => {
    const { enabled, isPlaying } = get();
    if (isPlaying) get().stop();
    set({ enabled: !enabled });
  },

  speak: async (text: string, language: "zh" | "en", messageId?: string) => {
    const { enabled } = get();
    if (!enabled || !text.trim()) return;

    get().stop();
    set({ isLoading: true, currentMessageId: messageId || null });

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });

      if (!res.ok) {
        console.warn("TTS API 返回非 200:", res.status);
        set({ isLoading: false, currentMessageId: null });
        return;
      }

      const blob = await res.blob();
      revokeCurrentUrl();
      const url = URL.createObjectURL(blob);
      currentObjectUrl = url;

      const audio = getTTSAudio();
      audio.src = url;

      audio.onended = () => {
        set({ isPlaying: false, currentMessageId: null });
        usePlayer.getState().restoreVolume();
        revokeCurrentUrl();
      };

      audio.onerror = () => {
        set({ isPlaying: false, isLoading: false, currentMessageId: null });
        usePlayer.getState().restoreVolume();
        revokeCurrentUrl();
      };

      usePlayer.getState().duckVolume();
      if (canAutoPlay()) await audio.play().catch(() => {});
      set({ isPlaying: true, isLoading: false });
    } catch (err) {
      console.error("TTS speak error:", err);
      set({ isLoading: false, currentMessageId: null });
      usePlayer.getState().restoreVolume();
    }
  },

  speakAndWait: async (text: string, language: "zh" | "en") => {
    const { enabled } = get();
    if (!enabled || !text.trim()) return;

    get().stop();
    set({ isLoading: true });

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });

      if (!res.ok) {
        console.warn("TTS API 返回非 200:", res.status);
        set({ isLoading: false });
        return;
      }

      const blob = await res.blob();
      revokeCurrentUrl();
      const url = URL.createObjectURL(blob);
      currentObjectUrl = url;

      const audio = getTTSAudio();
      audio.src = url;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          set({ isPlaying: false });
          usePlayer.getState().restoreVolume();
          revokeCurrentUrl();
          resolve();
        };

        audio.onerror = () => {
          set({ isPlaying: false, isLoading: false });
          usePlayer.getState().restoreVolume();
          revokeCurrentUrl();
          resolve();
        };

        usePlayer.getState().duckVolume();
        if (canAutoPlay()) {
          audio.play().then(() => {
            set({ isPlaying: true, isLoading: false });
          });
        } else {
          set({ isPlaying: false, isLoading: false });
        }
      });
    } catch (err) {
      console.warn("TTS speakAndWait 失败，跳过朗读:", err);
      set({ isLoading: false });
      usePlayer.getState().restoreVolume();
    }
  },

  speakAndWaitWithAudio: async (audioUrl: string) => {
    const { enabled } = get();
    if (!enabled) return;

    // 暂停当前播放但不 revoke URL（调用方的 URL 可能来自缓存）
    const audio = getTTSAudio();
    audio.pause();
    audio.currentTime = 0;
    set({ isPlaying: false, currentMessageId: null, isLoading: true });

    try {
      audio.src = audioUrl;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          set({ isPlaying: false });
          usePlayer.getState().restoreVolume();
          resolve();
        };

        audio.onerror = () => {
          set({ isPlaying: false, isLoading: false });
          usePlayer.getState().restoreVolume();
          resolve();
        };

        usePlayer.getState().duckVolume();
        if (canAutoPlay()) {
          audio.play().then(() => {
            set({ isPlaying: true, isLoading: false });
          });
        } else {
          set({ isPlaying: false, isLoading: false });
        }
      });
    } catch (err) {
      console.warn("TTS speakAndWaitWithAudio 失败，跳过朗读:", err);
      set({ isLoading: false });
      usePlayer.getState().restoreVolume();
    }
  },

  stop: () => {
    const audio = getTTSAudio();
    audio.pause();
    audio.currentTime = 0;
    set({ isPlaying: false, currentMessageId: null });
    usePlayer.getState().restoreVolume();
    revokeCurrentUrl();
  },
}));
