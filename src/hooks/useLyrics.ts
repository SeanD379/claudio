"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { usePlayer } from "./usePlayer";

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsState {
  lyrics: LyricLine[];
  currentIndex: number;
  isLoading: boolean;
  hasLyrics: boolean;

  fetchLyrics: (songId: string) => Promise<void>;
  updateCurrentIndex: (currentTime: number) => void;
  reset: () => void;
}

export const useLyrics = create<LyricsState>((set, get) => ({
  lyrics: [],
  currentIndex: -1,
  isLoading: false,
  hasLyrics: true,

  fetchLyrics: async (songId: string) => {
    set({ isLoading: true, currentIndex: -1, hasLyrics: true });

    try {
      const res = await fetch(`/api/music/lyric?id=${songId}`);
      if (!res.ok) {
        console.warn("歌词 API 返回非 200:", res.status);
        set({ lyrics: [], isLoading: false, hasLyrics: false });
        return;
      }

      const data = await res.json();
      const lyrics = data.lyrics || [];

      set({
        lyrics,
        isLoading: false,
        hasLyrics: lyrics.length > 0,
      });
    } catch (error) {
      console.warn("歌词获取失败，显示纯音乐模式:", error);
      set({ lyrics: [], isLoading: false, hasLyrics: false });
    }
  },

  updateCurrentIndex: (currentTime: number) => {
    const { lyrics, currentIndex } = get();
    if (lyrics.length === 0) return;

    // 找到当前应该显示的歌词行
    let newIndex = 0;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== currentIndex) {
      set({ currentIndex: newIndex });
    }
  },

  reset: () => {
    set({ lyrics: [], currentIndex: -1, hasLyrics: true });
  },
}));

// 自动同步播放时间的 hook
export function useLyricsSync() {
  const { currentSong, currentTime } = usePlayer();
  const { lyrics, currentIndex, hasLyrics, fetchLyrics, updateCurrentIndex, reset } =
    useLyrics();

  // 当歌曲变化时获取歌词
  const prevSongId = currentSong?.neteaseId;

  // 同步当前时间（移到 useEffect 中，避免渲染期调 setState）
  useEffect(() => {
    if (lyrics.length > 0) {
      updateCurrentIndex(currentTime);
    }
  }, [currentTime, lyrics, updateCurrentIndex]);

  const currentLyric = currentIndex >= 0 && currentIndex < lyrics.length
    ? lyrics[currentIndex].text
    : null;

  return {
    currentLyric,
    hasLyrics,
    isLoading: useLyrics((s) => s.isLoading),
    fetchLyrics,
    reset,
    songId: prevSongId,
  };
}
