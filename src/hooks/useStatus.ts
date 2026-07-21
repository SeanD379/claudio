"use client";

import { create } from "zustand";

export type MoodStatus =
  | "happy"
  | "sad"
  | "sleepy"
  | "excited"
  | "calm"
  | "daydreaming"
  | "music"
  | "coffee"
  | "night"
  | "exercise"
  | "reading"
  | "eating"
  | "gaming"
  | "working"
  | "social-tired";

export interface StatusConfig {
  id: MoodStatus;
  emoji: string;
  label: string;
  description: string;
}

export const ALL_STATUSES: StatusConfig[] = [
  { id: "happy", emoji: "😊", label: "开心", description: "摇尾巴、蹦跳" },
  { id: "sad", emoji: "😢", label: "难过", description: "趴着、耳朵耷拉" },
  { id: "sleepy", emoji: "😴", label: "困了", description: "打哈欠、眯眼" },
  { id: "excited", emoji: "🔥", label: "兴奋", description: "快速摇尾巴、转圈" },
  { id: "calm", emoji: "😌", label: "平静", description: "慢慢呼吸、偶尔眨眼" },
  { id: "daydreaming", emoji: "💭", label: "发呆", description: "望着远方、缓慢漂浮" },
  { id: "music", emoji: "🎵", label: "沉浸音乐", description: "闭眼、跟着节奏晃动" },
  { id: "coffee", emoji: "☕", label: "喝咖啡", description: "抱着杯子、小口喝" },
  { id: "night", emoji: "🌙", label: "深夜", description: "戴着睡帽、打瞌睡" },
  { id: "exercise", emoji: "💪", label: "运动", description: "做俯卧撑、跑步" },
  { id: "reading", emoji: "📖", label: "阅读", description: "翻书、推眼镜" },
  { id: "eating", emoji: "🍜", label: "吃饭", description: "抱着碗、大口吃" },
  { id: "gaming", emoji: "🎮", label: "玩游戏", description: "操作手柄、兴奋" },
  { id: "working", emoji: "💼", label: "工作", description: "敲键盘、皱眉" },
  { id: "social-tired", emoji: "🫠", label: "社交疲劳", description: "躲在角落、社恐脸" },
];

interface StatusState {
  currentStatus: MoodStatus;
  setStatus: (status: MoodStatus) => void;
}

export const useStatus = create<StatusState>((set) => ({
  currentStatus: "calm",
  setStatus: (status) => {
    set({ currentStatus: status });
    localStorage.setItem("claudio-pet-status", status);
  },
}));

// 初始化时从 localStorage 恢复
export function initStatus(): void {
  const saved = localStorage.getItem("claudio-pet-status") as MoodStatus | null;
  if (saved && ALL_STATUSES.find((s) => s.id === saved)) {
    useStatus.setState({ currentStatus: saved });
  }
}
