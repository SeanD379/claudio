"use client";

import { create } from "zustand";
import { usePlayer } from "./usePlayer";

// ── 转场状态机 ──
// idle ──(歌曲结束)──→ fading_out ──(2s)──→ dark ──(1s)──→ fading_in ──(1.5s)──→ idle
type TransitionPhase = "idle" | "fading_out" | "dark" | "fading_in";

const FADE_OUT_DURATION = 2.0;  // 灯光收束时间（秒）
const DARK_DURATION = 1.0;      // 全场黑暗时间（秒）
const FADE_IN_DURATION = 1.5;   // 灯光亮起时间（秒）

interface TransitionState {
  phase: TransitionPhase;
  // 0 = 全暗，1 = 全亮；舞台所有灯光乘以这个值
  intensity: number;
  // 转场开始时间戳
  phaseStartTime: number;
  // 当前歌曲 ID（用于检测歌曲切换）
  currentSongId: string | null;

  // 歌曲结束时调用
  onSongEnd: () => void;
  // 歌曲开始时调用
  onSongStart: (songId: string) => void;
  // 每帧更新（由 KtvStage 调用）
  tick: (now: number) => void;
}

export const useKtvTransition = create<TransitionState>((set, get) => ({
  phase: "idle",
  intensity: 1,
  phaseStartTime: 0,
  currentSongId: null,

  onSongEnd: () => {
    const state = get();
    // 只在播放中触发收束
    if (state.phase === "idle") {
      set({
        phase: "fading_out",
        phaseStartTime: performance.now() * 0.001,
      });
    }
  },

  onSongStart: (songId: string) => {
    const state = get();
    // 新歌曲开始，如果正在 dark 或 fading_out 阶段，直接进入 fading_in
    if (state.phase === "dark" || state.phase === "fading_out") {
      set({
        phase: "fading_in",
        phaseStartTime: performance.now() * 0.001,
        currentSongId: songId,
      });
    } else if (state.phase === "idle" && state.currentSongId !== songId) {
      // 歌曲切换但没有经过转场（比如用户手动切歌），也做一个快速淡入
      set({
        phase: "fading_in",
        phaseStartTime: performance.now() * 0.001,
        currentSongId: songId,
      });
    } else {
      set({ currentSongId: songId });
    }
  },

  tick: (now: number) => {
    const state = get();
    if (state.phase === "idle") {
      // 确保 intensity 为 1
      if (state.intensity !== 1) set({ intensity: 1 });
      return;
    }

    const elapsed = now - state.phaseStartTime;

    if (state.phase === "fading_out") {
      if (elapsed >= FADE_OUT_DURATION) {
        // 收束完成，进入黑暗
        set({ phase: "dark", phaseStartTime: now, intensity: 0 });
      } else {
        set({ intensity: 1 - elapsed / FADE_OUT_DURATION });
      }
    } else if (state.phase === "dark") {
      if (elapsed >= DARK_DURATION) {
        // 黑暗时间到，如果没有新歌就开始 fading_in（回到 idle 的 intensity=1）
        set({ phase: "fading_in", phaseStartTime: now, intensity: 0 });
      }
      // intensity 保持 0
    } else if (state.phase === "fading_in") {
      if (elapsed >= FADE_IN_DURATION) {
        set({ phase: "idle", intensity: 1 });
      } else {
        // ease-out 曲线，亮起时先快后慢
        const t = elapsed / FADE_IN_DURATION;
        set({ intensity: 1 - Math.pow(1 - t, 2) });
      }
    }
  },
}));

// ── 自动监听播放器事件 ──
let initialized = false;

export function initKtvTransitionListener() {
  if (initialized) return;
  initialized = true;

  const player = usePlayer.getState();
  const audio = player.audio;

  if (audio) {
    attachAudioListeners(audio);
  } else {
    // 等待 audio 元素就绪
    const unsub = usePlayer.subscribe((state) => {
      if (state.audio) {
        attachAudioListeners(state.audio);
        unsub();
      }
    });
  }
}

function attachAudioListeners(audio: HTMLAudioElement) {
  // 歌曲自然结束
  audio.addEventListener("ended", () => {
    useKtvTransition.getState().onSongEnd();
  });

  // 歌曲开始播放（play 事件）
  audio.addEventListener("play", () => {
    const playerState = usePlayer.getState();
    if (playerState.currentSong) {
      useKtvTransition.getState().onSongStart(playerState.currentSong.id);
    }
  });

  // 监听歌曲切换（currentSong 变化）
  let prevSongId: string | null = null;
  usePlayer.subscribe((state) => {
    const newId = state.currentSong?.id || null;
    if (newId && newId !== prevSongId) {
      prevSongId = newId;
      // 歌曲切换时触发转场（如果正在播放）
      if (state.isPlaying) {
        useKtvTransition.getState().onSongStart(newId);
      }
    }
  });
}
