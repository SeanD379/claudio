"use client";

import { create } from "zustand";
import { estimateBpm } from "@/app/lib/ktv-stage-motion";
import { usePlayer } from "./usePlayer";

export type MoodType = "tech" | "warm" | "redGold" | "minimal" | "cyber" | "rainbow";

export interface AudioData {
  // 能量值 (0-1)
  energy: number;
  // 低频能量 (0-1) - 用于bass响应
  bass: number;
  // 中频能量 (0-1)
  mid: number;
  // 高频能量 (0-1)
  high: number;
  // 节拍检测 (0-1, 基于能量变化)
  beat: number;
  // BPM 是稳定节拍间隔估算值
  bpm: number | null;
  // BPM 置信度控制舞台速度
  bpmConfident: boolean;
  // 当前判断的情绪
  mood: MoodType;
  // 是否有音频在播放
  isPlaying: boolean;
  // 原始频谱数据 (0-255)，用于副屏可视化
  frequency: Uint8Array;
  // 放大后的频谱（用于可视化，值域 0-255，经过峰值提升）
  freqBoosted: Uint8Array;
}

interface AnalyzerState extends AudioData {
  // 初始化分析器
  init: (audioElement: HTMLAudioElement) => void;
  // 更新数据（内部调用）
  update: (data: Partial<AudioData>) => void;
}

// 频谱分析参数
const FFT_SIZE = 256;
const SMOOTHING = 0.8;

// 情绪判断阈值
const MOOD_THRESHOLDS = {
  // 高能快歌 → 科技未来感
  tech: { energyMin: 0.5, bpmApprox: "fast" },
  // 中等节奏 → 华丽剧场感
  warm: { energyMin: 0.3, bpmApprox: "medium" },
  // 慢歌抒情 → 极简震撼
  minimal: { energyMax: 0.3 },
  // 低频突出 → 赛博朋克
  cyber: { bassMin: 0.6 },
  // 高频突出 → 彩虹棱镜
  rainbow: { highMin: 0.5 },
  // 默认 → 红金盛典
  redGold: {},
};

// 基于能量和频谱分布判断情绪
function detectMood(energy: number, bass: number, mid: number, high: number): MoodType {
  // 高能 + 低频突出 → 赛博朋克
  if (energy > 0.5 && bass > 0.6) return "cyber";

  // 高能 + 高频突出 → 彩虹
  if (energy > 0.4 && high > 0.5) return "rainbow";

  // 高能 → 科技未来感
  if (energy > 0.55) return "tech";

  // 中等能量 → 华丽剧场
  if (energy > 0.3) return "warm";

  // 低能量 → 极简震撼
  if (energy < 0.25) return "minimal";

  // 默认 → 红金盛典
  return "redGold";
}

export const useAudioAnalyzer = create<AnalyzerState>((set, get) => ({
  energy: 0,
  bass: 0,
  mid: 0,
  high: 0,
  beat: 0,
  bpm: null,
  bpmConfident: false,
  mood: "tech",
  isPlaying: false,
  frequency: new Uint8Array(0),
  freqBoosted: new Uint8Array(0),

  init: (audioElement: HTMLAudioElement) => {
    // 避免重复初始化
    if ((audioElement as any).__analyzerAttached) return;
    (audioElement as any).__analyzerAttached = true;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audioElement);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;

      source.connect(analyser);
      analyser.connect(audioContext.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const prevEnergy = { value: 0 };
      const beatTimesMs: number[] = [];
      let lastBeatAt = 0;

      // 动画循环分析音频
      const analyze = () => {
        requestAnimationFrame(analyze);

        if (audioElement.paused) {
          if (get().isPlaying) {
            beatTimesMs.length = 0;
            lastBeatAt = 0;
            prevEnergy.value = 0;
            set({ isPlaying: false, energy: 0, bass: 0, mid: 0, high: 0, beat: 0, bpm: null, bpmConfident: false, frequency: new Uint8Array(0), freqBoosted: new Uint8Array(0) });
          }
          return;
        }

        analyser.getByteFrequencyData(dataArray);

        // 计算各频段能量
        const bassEnd = Math.floor(bufferLength * 0.15);   // 低频 (0-15%)
        const midEnd = Math.floor(bufferLength * 0.5);      // 中频 (15-50%)
        // 高频 (50-100%)

        let bassSum = 0, midSum = 0, highSum = 0, totalSum = 0;

        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i] / 255;
          totalSum += val;
          if (i < bassEnd) bassSum += val;
          else if (i < midEnd) midSum += val;
          else highSum += val;
        }

        const energy = totalSum / bufferLength;
        const bass = bassSum / bassEnd;
        const mid = midSum / (midEnd - bassEnd);
        const high = highSum / (bufferLength - midEnd);

        // 节拍检测 - 基于能量变化
        const energyDelta = Math.abs(energy - prevEnergy.value);
        const beat = Math.min(1, energyDelta * 5);
        prevEnergy.value = energy;
        const now = performance.now();
        if (beat >= 0.45 && now - lastBeatAt >= 250) {
          lastBeatAt = now;
          beatTimesMs.push(now);
          if (beatTimesMs.length > 12) beatTimesMs.shift();
        }
        const { bpm, confident: bpmConfident } = estimateBpm(beatTimesMs);

        // 情绪判断
        const mood = detectMood(energy, bass, mid, high);

        // 放大频谱：取每个bin所在区间的峰值，再乘以增益
        const boostedData = new Uint8Array(bufferLength);
        const boostGain = 2.5; // 增益倍数
        for (let i = 0; i < bufferLength; i++) {
          // 取左右各2个bin的峰值
          let peak = dataArray[i];
          for (let j = Math.max(0, i - 2); j <= Math.min(bufferLength - 1, i + 2); j++) {
            if (dataArray[j] > peak) peak = dataArray[j];
          }
          boostedData[i] = Math.min(255, Math.floor(peak * boostGain));
        }

        set({
          energy,
          bass,
          mid,
          high,
          beat,
          bpm,
          bpmConfident,
          mood,
          isPlaying: true,
          frequency: new Uint8Array(dataArray),
          freqBoosted: boostedData,
        });
      };

      analyze();

      // 用户交互后恢复 AudioContext（浏览器自动播放策略）
      const resumeContext = () => {
        if (audioContext.state === "suspended") {
          audioContext.resume();
        }
      };
      document.addEventListener("click", resumeContext, { once: true });
      document.addEventListener("keydown", resumeContext, { once: true });

    } catch (err) {
      console.error("[AudioAnalyzer] 初始化失败:", err);
    }
  },

  update: (data) => set(data),
}));
