"use client";

import { create } from "zustand";

// 浏览器自动播放策略：记录用户是否已交互
let userHasInteracted = false;
if (typeof window !== "undefined") {
  const markInteracted = () => { userHasInteracted = true; };
  window.addEventListener("click", markInteracted, { once: true });
  window.addEventListener("keydown", markInteracted, { once: true });
  window.addEventListener("touchstart", markInteracted, { once: true });
}

export function canAutoPlay() {
  return userHasInteracted;
}

export type PlayMode = "sequential" | "shuffle" | "repeat-one" | "repeat-all";

export interface Song {
  id: string;
  neteaseId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  audioUrl?: string;
}

function generateShuffleOrder(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

interface PlayerState {
  currentSong: Song | null;
  playlist: Song[];
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  volume: number;
  isLoading: boolean;
  audio: HTMLAudioElement | null;
  beforePlay: ((song: Song) => Promise<void>) | null;
  playMode: PlayMode;
  shuffleOrder: number[];
  shufflePosition: number;
  onPlaylistEnd: (() => void) | null;
  playHistory: Song[];

  initAudio: () => void;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  setVolume: (volume: number) => void;
  seekTo: (percent: number) => void;
  setPlaylist: (songs: Song[]) => void;
  setAndPlay: (songs: Song[], song: Song) => void;
  searchAndPlay: (keyword: string) => Promise<void>;
  setBeforePlay: (fn: ((song: Song) => Promise<void>) | null) => void;
  cycleRepeat: () => void;
  duckVolume: () => void;
  restoreVolume: () => void;
  restorePlayMode: () => void;
  addToHistory: (song: Song) => void;
}

let audioElement: HTMLAudioElement | null = null;
let listenersAttached = false;

function getAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = "auto";
  }
  return audioElement;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  currentSong: null,
  playlist: [],
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  volume: 80,
  isLoading: false,
  audio: null,
  beforePlay: null,
  playMode: "sequential",
  shuffleOrder: [],
  shufflePosition: 0,
  onPlaylistEnd: null,
  playHistory: (() => {
    try {
      const saved = localStorage.getItem("claudio-play-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  setBeforePlay: (fn) => {
    set({ beforePlay: fn });
  },

  cycleRepeat: () => {
    const { playMode, playlist, currentSong } = get();
    const next: Record<string, PlayMode> = {
      sequential: "repeat-all",
      "repeat-all": "repeat-one",
      "repeat-one": "shuffle",
      shuffle: "sequential",
    };
    const mode = next[playMode] || "sequential";

    if (mode === "shuffle" && playlist.length > 0) {
      const idx = currentSong
        ? playlist.findIndex((s) => s.neteaseId === currentSong.neteaseId)
        : -1;
      const order = generateShuffleOrder(playlist.length);
      if (idx >= 0) {
        const pos = order.indexOf(idx);
        if (pos > 0) [order[0], order[pos]] = [order[pos], order[0]];
      }
      set({ playMode: mode, shuffleOrder: order, shufflePosition: 0 });
    } else {
      set({ playMode: mode });
    }
    localStorage.setItem("claudio-play-mode", mode);
  },

  initAudio: () => {
    const audio = getAudio();
    set({ audio });

    if (!listenersAttached) {
      listenersAttached = true;

      // 节流 timeupdate：用 rAF 限制每帧最多更新一次
      let timeupdateRaf = 0;
      audio.addEventListener("timeupdate", () => {
        if (timeupdateRaf) return;
        timeupdateRaf = requestAnimationFrame(() => {
          timeupdateRaf = 0;
          if (audio.duration) {
            set({
              progress: (audio.currentTime / audio.duration) * 100,
              currentTime: audio.currentTime,
            });
          }
        });
      });

      audio.addEventListener("ended", () => {
        get().nextSong();
      });

      audio.addEventListener("play", () => set({ isPlaying: true }));
      audio.addEventListener("pause", () => set({ isPlaying: false }));
    }

    audio.volume = get().volume / 100;
  },

  playSong: async (song: Song) => {
    if (!song) return;
    const audio = getAudio();
    if (!get().audio) get().initAudio();

    // 切歌时暂停当前音乐
    if (!audio.paused) {
      audio.pause();
    }

    set({ isLoading: true, currentSong: song });

    try {
      const { beforePlay } = get();
      if (beforePlay) {
        const shouldBlock = await beforePlay(song).then(() => false).catch(() => true);
        if (shouldBlock) {
          set({ isLoading: false });
          return; // 阻止播放
        }
      }

      let audioUrl = song.audioUrl;
      let updatedSong = song;

      if (!audioUrl) {
        const res = await fetch(`/api/music/song?id=${song.neteaseId}`);
        if (res.ok) {
          const data = await res.json();
          audioUrl = data.audioUrl;
          // 更新歌曲完整信息（封面、时长等）
          if (data.coverUrl || data.duration) {
            updatedSong = {
              ...song,
              coverUrl: data.coverUrl || song.coverUrl,
              duration: data.duration || song.duration,
            };
            // 同时更新 currentSong 和 playlist 中的对应歌曲
            const { playlist } = get();
            const updatedPlaylist = playlist.map((s) =>
              s.neteaseId === song.neteaseId ? updatedSong : s
            );
            set({ currentSong: updatedSong, playlist: updatedPlaylist });
          }
        }
      }

      if (!audioUrl) {
        console.error("No audio URL available for this song");
        set({ isLoading: false });
        return;
      }

      audio.src = audioUrl;
      if (canAutoPlay()) {
        await audio.play().catch(() => {});
      }
      set({ isPlaying: true, isLoading: false });
      // 记录播放历史
      get().addToHistory(updatedSong);
      // 记录到日历播放记录
      fetch("/api/calendar/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: updatedSong.neteaseId,
          duration: updatedSong.duration,
          title: updatedSong.title,
          artist: updatedSong.artist,
          album: updatedSong.album,
          coverUrl: updatedSong.coverUrl,
        }),
      }).catch(() => {});
    } catch (err) {
      console.error("Failed to play song:", err);
      set({ isLoading: false });
    }
  },

  togglePlay: () => {
    const { audio, currentSong, playlist } = get();
    const a = audio || getAudio();

    if (!currentSong && playlist.length > 0) {
      get().playSong(playlist[0]);
      return;
    }

    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  },

  nextSong: () => {
    const { currentSong, playlist, playMode, shuffleOrder, shufflePosition } =
      get();
    if (!currentSong || playlist.length === 0) return;

    if (playMode === "repeat-one") {
      get().playSong(currentSong);
      return;
    }

    if (playMode === "shuffle") {
      if (shuffleOrder.length === 0) return;
      const nextPos = (shufflePosition + 1) % shuffleOrder.length;
      set({ shufflePosition: nextPos });
      get().playSong(playlist[shuffleOrder[nextPos]]);
      return;
    }

    const currentIndex = playlist.findIndex(
      (s) => s.neteaseId === currentSong.neteaseId
    );
    const nextIndex = (currentIndex + 1) % playlist.length;
    if (nextIndex === 0 && playMode === "sequential") {
      const { onPlaylistEnd } = get();
      set({ isPlaying: false });
      if (onPlaylistEnd) onPlaylistEnd();
      return;
    }
    get().playSong(playlist[nextIndex]);
  },

  prevSong: () => {
    const { currentSong, playlist, playMode, shuffleOrder, shufflePosition } =
      get();
    if (!currentSong || playlist.length === 0) return;

    if (playMode === "repeat-one") {
      get().playSong(currentSong);
      return;
    }

    if (playMode === "shuffle") {
      if (shuffleOrder.length === 0) return;
      const prevPos =
        (shufflePosition - 1 + shuffleOrder.length) % shuffleOrder.length;
      set({ shufflePosition: prevPos });
      get().playSong(playlist[shuffleOrder[prevPos]]);
      return;
    }

    const currentIndex = playlist.findIndex(
      (s) => s.neteaseId === currentSong.neteaseId
    );
    const prevIndex =
      (currentIndex - 1 + playlist.length) % playlist.length;
    get().playSong(playlist[prevIndex]);
  },

  setVolume: (volume: number) => {
    const audio = getAudio();
    audio.volume = volume / 100;
    set({ volume });
  },

  seekTo: (percent: number) => {
    const audio = getAudio();
    if (audio.duration) {
      audio.currentTime = (percent / 100) * audio.duration;
    }
  },

  setPlaylist: (songs: Song[]) => {
    const { playMode } = get();
    if (playMode === "shuffle") {
      set({
        playlist: songs,
        shuffleOrder: generateShuffleOrder(songs.length),
        shufflePosition: 0,
      });
    } else {
      set({ playlist: songs });
    }
  },

  setAndPlay: (songs: Song[], song: Song) => {
    const { playMode } = get();
    if (playMode === "shuffle") {
      const idx = songs.findIndex((s) => s.neteaseId === song.neteaseId);
      const order = generateShuffleOrder(songs.length);
      if (idx >= 0) {
        const pos = order.indexOf(idx);
        if (pos > 0) [order[0], order[pos]] = [order[pos], order[0]];
      }
      set({
        playlist: songs,
        shuffleOrder: order,
        shufflePosition: 0,
      });
    } else {
      set({ playlist: songs });
    }
    get().playSong(song);
  },

  searchAndPlay: async (keyword: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(keyword)}&limit=10`
      );
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      const songs: Song[] = data.songs || [];

      if (songs.length === 0) {
        set({ isLoading: false });
        return;
      }

      set({ playlist: songs });
      get().playSong(songs[0]);
    } catch (err) {
      console.error("Search and play failed:", err);
      set({ isLoading: false });
    }
  },

  duckVolume: () => {
    const audio = getAudio();
    const { volume } = get();
    const target = (volume / 100) * 0.2;
    // 防止重复闪避：如果已经低于目标，不重复操作
    if (audio.volume <= target + 0.01) return;
    const step = (audio.volume - target) / 10;
    let i = 0;
    const fade = () => {
      i++;
      audio.volume = Math.max(target, audio.volume - step);
      if (i < 10) requestAnimationFrame(fade);
    };
    fade();
  },

  restoreVolume: () => {
    const audio = getAudio();
    const { volume } = get();
    const target = volume / 100;
    // 防止重复恢复：如果已经接近目标，不重复操作
    if (Math.abs(audio.volume - target) < 0.01) return;
    const step = (target - audio.volume) / 10;
    let i = 0;
    const fade = () => {
      i++;
      audio.volume = Math.min(target, audio.volume + step);
      if (i < 10) requestAnimationFrame(fade);
    };
    fade();
  },

  restorePlayMode: () => {
    const saved = localStorage.getItem("claudio-play-mode") as PlayMode | null;
    if (saved && saved !== get().playMode) {
      const { playlist, currentSong } = get();
      if (saved === "shuffle" && playlist.length > 0) {
        const idx = currentSong
          ? playlist.findIndex((s) => s.neteaseId === currentSong.neteaseId)
          : -1;
        const order = generateShuffleOrder(playlist.length);
        if (idx >= 0) {
          const pos = order.indexOf(idx);
          if (pos > 0) [order[0], order[pos]] = [order[pos], order[0]];
        }
        set({ playMode: saved, shuffleOrder: order, shufflePosition: 0 });
      } else {
        set({ playMode: saved });
      }
    }
  },

  addToHistory: (song: Song) => {
    const { playHistory } = get();
    // 去重：移除已存在的同一首歌
    const filtered = playHistory.filter((s) => s.neteaseId !== song.neteaseId);
    // 添加到开头，最多保留 20 首
    const newHistory = [song, ...filtered].slice(0, 20);
    set({ playHistory: newHistory });
    try {
      localStorage.setItem("claudio-play-history", JSON.stringify(newHistory));
    } catch {
      // localStorage 满了就忽略
    }
  },
}));
