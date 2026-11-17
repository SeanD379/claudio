"use client";

import { create } from "zustand";
import { useTheme } from "./useTheme";
import { createLoadingId, loadingError, recordLoading, type LoadingError } from "@/app/lib/loading-diagnostics";

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
  playbackError: LoadingError | null;
  loadingSlow: boolean;
  requestId: string | null;
  audio: HTMLAudioElement | null;
  beforePlay: ((song: Song) => Promise<void>) | null;
  playMode: PlayMode;
  shuffleOrder: number[];
  shufflePosition: number;
  onPlaylistEnd: (() => void) | null;
  playHistory: Song[];
  sleepTimerEndAt: number | null;

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
  restorePlayMode: () => void;
  addToHistory: (song: Song) => void;
  setSleepTimer: (minutes: number | null) => void;
}

let audioElement: HTMLAudioElement | null = null;
let listenersAttached = false;
let sleepTimerId: ReturnType<typeof setTimeout> | null = null;
let activePlayback: { controller: AbortController; cleanup: () => void; wait: () => void; fail: (category: LoadingError) => void;
  log: (stage: string, result: "start" | "success" | "failure" | "cancelled", errorCategory?: LoadingError) => void } | null = null;

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
  playbackError: null,
  loadingSlow: false,
  requestId: null,
  audio: null,
  beforePlay: null,
  playMode: "sequential",
  shuffleOrder: [],
  shufflePosition: 0,
  onPlaylistEnd: null,
  sleepTimerEndAt: null,
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

  setSleepTimer: (minutes) => {
    if (sleepTimerId) {
      clearTimeout(sleepTimerId);
      sleepTimerId = null;
    }

    if (!minutes) {
      set({ sleepTimerEndAt: null });
      return;
    }

    const sleepTimerEndAt = Date.now() + minutes * 60 * 1000;
    sleepTimerId = setTimeout(() => {
      audioElement?.pause();
      sleepTimerId = null;
      set({ sleepTimerEndAt: null });
    }, minutes * 60 * 1000);
    set({ sleepTimerEndAt });
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

    }

    audio.volume = get().volume / 100;
  },

  playSong: async (song: Song) => {
    if (!song) return;
    const audio = getAudio();
    if (!get().audio) get().initAudio();
    if (activePlayback) {
      activePlayback.controller.abort();
      activePlayback.cleanup();
      activePlayback.log("superseded", "cancelled", "cancelled");
    }
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    const start = performance.now();
    const requestId = createLoadingId();
    const controller = new AbortController();
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const listeners: Array<[string, EventListener]> = [];
    const log = (stage: string, result: "start" | "success" | "failure" | "cancelled", errorCategory?: LoadingError) => {
      recordLoading({ requestId, songId: song.neteaseId, stage, elapsedMs: performance.now() - start, result, errorCategory });
    };
    const clearTimers = () => { clearTimeout(slowTimer); clearTimeout(deadline); };
    const attempt = { controller, log, wait: () => wait(), fail: (category: LoadingError) => fail(category), cleanup: () => {
      clearTimers();
      for (const [name, listener] of listeners) audio.removeEventListener(name, listener);
    } };
    activePlayback = attempt;
    const isCurrent = () => activePlayback === attempt && !controller.signal.aborted;
    const fail = (category: LoadingError) => {
      if (!isCurrent()) return;
      log("failure", "failure", category);
      attempt.cleanup();
      controller.abort();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      set({ isPlaying: false, isLoading: false, loadingSlow: false, playbackError: category });
    };
    const wait = () => {
      clearTimers();
      slowTimer = setTimeout(() => {
        if (isCurrent() && get().isLoading) { set({ loadingSlow: true }); log("slow", "start"); }
      }, 3000);
      deadline = setTimeout(() => fail("timeout"), 15000);
    };
    set({ isLoading: true, isPlaying: false, currentSong: song, currentTime: 0, progress: 0,
      playbackError: null, loadingSlow: false, requestId });
    log("click", "start");
    log("feedback-state", "success");
    let updatedSong = song;
    try {
      const { beforePlay } = get();
      if (beforePlay) {
        const shouldBlock = await beforePlay(song).then(() => false).catch(() => true);
        if (!isCurrent()) return;
        log("before-play", shouldBlock ? "cancelled" : "success", shouldBlock ? "precondition" : undefined);
        if (shouldBlock) {
          attempt.cleanup();
          controller.abort();
          set({ isLoading: false, loadingSlow: false });
          return; // 阻止播放
        }
      }

      wait();
      let audioUrl = song.audioUrl;
      if (!audioUrl) {
        log("url-request", "start");
        const res = await fetch(`/api/music/song?id=${encodeURIComponent(song.neteaseId)}`, {
          signal: controller.signal, headers: { "X-Request-ID": requestId },
        });
        if (!isCurrent()) return;
        const data = await res.json();
        if (!isCurrent()) return;
        if (!res.ok || !data.audioUrl) {
          const categories: LoadingError[] = ["network", "timeout", "auth", "unavailable", "upstream"];
          fail(categories.includes(data.errorCategory) ? data.errorCategory : res.status === 401 ? "auth" : "upstream");
          return;
        }
        if (res.ok) {
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
        fail("unavailable");
        return;
      }
      if (!isCurrent()) return;
      log("url-ready", "success");
      let firstPlayback = true;
      const on = (name: string, listener: EventListener) => {
        const guarded: EventListener = (event) => {
          if (isCurrent() && audio.src === audioUrl) listener(event);
        };
        listeners.push([name, guarded]);
        audio.addEventListener(name, guarded);
      };
      on("playing", () => {
        if (audio.paused || audio.readyState < 2) return;
        clearTimers();
        set({ isPlaying: true, isLoading: false, loadingSlow: false, playbackError: null });
        log(firstPlayback ? "playing" : "resumed", "success");
        if (!firstPlayback) return;
        firstPlayback = false;
        get().addToHistory(updatedSong);
        fetch("/api/calendar/record", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: updatedSong.neteaseId, duration: updatedSong.duration,
            title: updatedSong.title, artist: updatedSong.artist, album: updatedSong.album, coverUrl: updatedSong.coverUrl }),
        }).catch(() => {});
      });
      on("waiting", () => {
        if (audio.paused) return;
        set({ isLoading: true, isPlaying: false }); log("buffering", "start"); wait();
      });
      on("stalled", () => log("stalled", "start"));
      on("pause", () => {
        if (!audio.paused) return;
        clearTimers(); set({ isPlaying: false, isLoading: false, loadingSlow: false }); log("paused", "success");
      });
      on("error", () => { if (audio.error) fail(audio.error.code === 2 ? "network" : "media"); });
      on("ended", () => {
        clearTimers(); set({ isPlaying: false, isLoading: false, loadingSlow: false }); log("ended", "success");
        if (useTheme.getState().autoPlay) get().nextSong();
      });
      audio.src = audioUrl;
      // Compare the browser-normalized URL in event guards.
      audioUrl = audio.src;
      log("source-set", "success");
      audio.load();
      if (canAutoPlay()) {
        await audio.play();
      } else {
        fail("autoplay");
      }
    } catch (err) {
      if (isCurrent()) fail(loadingError(err));
    }
  },

  togglePlay: () => {
    const { audio, currentSong, playlist } = get();
    const a = audio || getAudio();

    if (!currentSong && playlist.length > 0) {
      get().playSong(playlist[0]);
      return;
    }

    if (currentSong && (get().playbackError || !a.src)) {
      get().playSong(currentSong);
      return;
    }
    if (a.paused) {
      const attempt = activePlayback;
      set({ isLoading: true });
      attempt?.wait();
      a.play().catch((error) => {
        if (activePlayback === attempt && !attempt?.controller.signal.aborted) attempt?.fail(loadingError(error));
      });
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
