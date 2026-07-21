"use client";

import { useEffect, useRef } from "react";
import { useAudioAnalyzer, type MoodType } from "@/hooks/useAudioAnalyzer";
import { useKtvTransition } from "@/hooks/useKtvTransition";
import { useMoodLock } from "@/hooks/useMoodLock";

const MOOD: Record<MoodType, { primary: number[]; secondary: number[]; accent: number[] }> = {
  minimal: { primary: [140, 160, 210], secondary: [100, 120, 170], accent: [190, 200, 230] },   // 月光
  warm:    { primary: [230, 175, 100], secondary: [200, 140, 70],  accent: [245, 210, 160] },   // 暖阳
  cyber:   { primary: [200, 110, 155], secondary: [170, 90, 130],  accent: [225, 170, 200] },   // 玫瑰
  tech:    { primary: [80, 150, 210],  secondary: [60, 120, 180],  accent: [150, 200, 240] },   // 冰蓝
  redGold: { primary: [210, 145, 70],  secondary: [180, 110, 50],  accent: [235, 195, 130] },   // 琥珀
  rainbow: { primary: [150, 110, 190], secondary: [120, 85, 160],  accent: [190, 160, 220] },   // 紫晶
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function lerpC(a: number[], b: number[], t: number): number[] { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function rgba(c: number[], a: number) { return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ═══════════════════════════════════════════════════════════
// 灯光类型定义
// ═══════════════════════════════════════════════════════════
type LightMotion =
  | { type: "static" }
  | { type: "sweep"; axis: "x" | "xy"; speed: number; amp: number }
  | { type: "pulse"; speed: number; amp: number }
  | { type: "chase"; speed: number; phase: number };

interface LightDef {
  id: string;
  type: string;
  fixtureX: number; fixtureY: number; // 灯具位置 (0-1)
  targetX: number; targetY: number;   // 目标位置 (0-1)
  topWidth: number;                    // 灯具端宽度 (px)
  botWidth: number;                    // 目标端宽度 (px)
  alphaBase: number;
  alphaBeat: number;
  slices: number;
  colorKey: "primary" | "secondary" | "accent";
  motion: LightMotion;
  drawOrder: number;
}

// ═══════════════════════════════════════════════════════════
// 30盏灯的完整配置
// ═══════════════════════════════════════════════════════════
const LIGHTS: LightDef[] = [
  // ── 1. 帕灯/染色灯 × 4（宽角度地面染色）──
  { id: "par-1", type: "帕灯", fixtureX: 0.15, fixtureY: 0.06, targetX: 0.20, targetY: 0.72, topWidth: 8, botWidth: 120, alphaBase: 0.12, alphaBeat: 0.06, slices: 5, colorKey: "primary",   motion: { type: "pulse", speed: 0.25, amp: 0.3 }, drawOrder: 10 },
  { id: "par-2", type: "帕灯", fixtureX: 0.38, fixtureY: 0.06, targetX: 0.35, targetY: 0.74, topWidth: 8, botWidth: 130, alphaBase: 0.11, alphaBeat: 0.05, slices: 5, colorKey: "secondary", motion: { type: "pulse", speed: 0.22, amp: 0.25 }, drawOrder: 10 },
  { id: "par-3", type: "帕灯", fixtureX: 0.62, fixtureY: 0.06, targetX: 0.65, targetY: 0.74, topWidth: 8, botWidth: 130, alphaBase: 0.11, alphaBeat: 0.05, slices: 5, colorKey: "secondary", motion: { type: "pulse", speed: 0.22, amp: 0.25 }, drawOrder: 10 },
  { id: "par-4", type: "帕灯", fixtureX: 0.85, fixtureY: 0.06, targetX: 0.80, targetY: 0.72, topWidth: 8, botWidth: 120, alphaBase: 0.12, alphaBeat: 0.06, slices: 5, colorKey: "primary",   motion: { type: "pulse", speed: 0.25, amp: 0.3 }, drawOrder: 10 },

  // ── 2. 光束灯 × 6（空中切割光束矩阵）──
  { id: "beam-1", type: "光束灯", fixtureX: 0.12, fixtureY: 0.06, targetX: 0.08, targetY: 0.78, topWidth: 3, botWidth: 18, alphaBase: 0.55, alphaBeat: 0.35, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.4, amp: 0.08 }, drawOrder: 30 },
  { id: "beam-2", type: "光束灯", fixtureX: 0.28, fixtureY: 0.06, targetX: 0.25, targetY: 0.80, topWidth: 3, botWidth: 18, alphaBase: 0.50, alphaBeat: 0.30, slices: 7, colorKey: "primary", motion: { type: "sweep", axis: "x", speed: 0.35, amp: 0.06 }, drawOrder: 30 },
  { id: "beam-3", type: "光束灯", fixtureX: 0.44, fixtureY: 0.06, targetX: 0.42, targetY: 0.82, topWidth: 3, botWidth: 18, alphaBase: 0.55, alphaBeat: 0.35, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.38, amp: 0.05 }, drawOrder: 30 },
  { id: "beam-4", type: "光束灯", fixtureX: 0.56, fixtureY: 0.06, targetX: 0.58, targetY: 0.82, topWidth: 3, botWidth: 18, alphaBase: 0.55, alphaBeat: 0.35, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.38, amp: 0.05 }, drawOrder: 30 },
  { id: "beam-5", type: "光束灯", fixtureX: 0.72, fixtureY: 0.06, targetX: 0.75, targetY: 0.80, topWidth: 3, botWidth: 18, alphaBase: 0.50, alphaBeat: 0.30, slices: 7, colorKey: "primary", motion: { type: "sweep", axis: "x", speed: 0.35, amp: 0.06 }, drawOrder: 30 },
  { id: "beam-6", type: "光束灯", fixtureX: 0.88, fixtureY: 0.06, targetX: 0.92, targetY: 0.78, topWidth: 3, botWidth: 18, alphaBase: 0.55, alphaBeat: 0.35, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.4, amp: 0.08 }, drawOrder: 30 },

  // ── 3. 切割灯 × 3（精准光斑控制）──
  { id: "cut-1", type: "切割灯", fixtureX: 0.22, fixtureY: 0.06, targetX: 0.20, targetY: 0.68, topWidth: 5, botWidth: 45, alphaBase: 0.35, alphaBeat: 0.15, slices: 5, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.2, amp: 0.04 }, drawOrder: 25 },
  { id: "cut-2", type: "切割灯", fixtureX: 0.50, fixtureY: 0.06, targetX: 0.50, targetY: 0.70, topWidth: 5, botWidth: 50, alphaBase: 0.40, alphaBeat: 0.20, slices: 5, colorKey: "primary", motion: { type: "sweep", axis: "xy", speed: 0.15, amp: 0.03 }, drawOrder: 25 },
  { id: "cut-3", type: "切割灯", fixtureX: 0.78, fixtureY: 0.06, targetX: 0.80, targetY: 0.68, topWidth: 5, botWidth: 45, alphaBase: 0.35, alphaBeat: 0.15, slices: 5, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.2, amp: 0.04 }, drawOrder: 25 },

  // ── 4. 成像灯 × 2（投射图案/Logo）──
  { id: "image-1", type: "成像灯", fixtureX: 0.10, fixtureY: 0.06, targetX: 0.30, targetY: 0.60, topWidth: 6, botWidth: 65, alphaBase: 0.20, alphaBeat: 0.10, slices: 3, colorKey: "secondary", motion: { type: "pulse", speed: 0.15, amp: 0.2 }, drawOrder: 20 },
  { id: "image-2", type: "成像灯", fixtureX: 0.90, fixtureY: 0.06, targetX: 0.70, targetY: 0.60, topWidth: 6, botWidth: 65, alphaBase: 0.20, alphaBeat: 0.10, slices: 3, colorKey: "secondary", motion: { type: "pulse", speed: 0.15, amp: 0.2 }, drawOrder: 20 },

  // ── 5. 三合一电脑灯 × 3（多模式，强光束+染色）──
  { id: "combo-1", type: "三合一", fixtureX: 0.30, fixtureY: 0.06, targetX: 0.22, targetY: 0.75, topWidth: 4, botWidth: 25, alphaBase: 0.45, alphaBeat: 0.30, slices: 7, colorKey: "primary", motion: { type: "sweep", axis: "x", speed: 0.3, amp: 0.10 }, drawOrder: 35 },
  { id: "combo-2", type: "三合一", fixtureX: 0.50, fixtureY: 0.06, targetX: 0.50, targetY: 0.78, topWidth: 4, botWidth: 28, alphaBase: 0.50, alphaBeat: 0.35, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "xy", speed: 0.25, amp: 0.08 }, drawOrder: 35 },
  { id: "combo-3", type: "三合一", fixtureX: 0.70, fixtureY: 0.06, targetX: 0.78, targetY: 0.75, topWidth: 4, botWidth: 25, alphaBase: 0.45, alphaBeat: 0.30, slices: 7, colorKey: "primary", motion: { type: "sweep", axis: "x", speed: 0.3, amp: 0.10 }, drawOrder: 35 },

  // ── 6. 聚光灯 × 2（主舞台聚焦）──
  { id: "spot-1", type: "聚光灯", fixtureX: 0.35, fixtureY: 0.02, targetX: 0.38, targetY: 0.72, topWidth: 4, botWidth: 55, alphaBase: 0.35, alphaBeat: 0.20, slices: 5, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.12, amp: 0.03 }, drawOrder: 22 },
  { id: "spot-2", type: "聚光灯", fixtureX: 0.65, fixtureY: 0.02, targetX: 0.62, targetY: 0.72, topWidth: 4, botWidth: 55, alphaBase: 0.35, alphaBeat: 0.20, slices: 5, colorKey: "accent", motion: { type: "sweep", axis: "x", speed: 0.12, amp: 0.03 }, drawOrder: 22 },

  // ── 7. 面光灯 × 4（前方补光，从桁架前方向下照）──
  { id: "front-1", type: "面光灯", fixtureX: 0.18, fixtureY: 0.10, targetX: 0.25, targetY: 0.65, topWidth: 10, botWidth: 90, alphaBase: 0.15, alphaBeat: 0.08, slices: 5, colorKey: "accent", motion: { type: "static" }, drawOrder: 8 },
  { id: "front-2", type: "面光灯", fixtureX: 0.38, fixtureY: 0.10, targetX: 0.40, targetY: 0.67, topWidth: 10, botWidth: 95, alphaBase: 0.15, alphaBeat: 0.08, slices: 5, colorKey: "primary", motion: { type: "static" }, drawOrder: 8 },
  { id: "front-3", type: "面光灯", fixtureX: 0.62, fixtureY: 0.10, targetX: 0.60, targetY: 0.67, topWidth: 10, botWidth: 95, alphaBase: 0.15, alphaBeat: 0.08, slices: 5, colorKey: "primary", motion: { type: "static" }, drawOrder: 8 },
  { id: "front-4", type: "面光灯", fixtureX: 0.82, fixtureY: 0.10, targetX: 0.75, targetY: 0.65, topWidth: 10, botWidth: 90, alphaBase: 0.15, alphaBeat: 0.08, slices: 5, colorKey: "accent", motion: { type: "static" }, drawOrder: 8 },

  // ── 8. 观众灯 × 2（扫射观众区，向下越过舞台边缘）──
  { id: "aud-1", type: "观众灯", fixtureX: 0.08, fixtureY: 0.06, targetX: 0.15, targetY: 0.95, topWidth: 5, botWidth: 100, alphaBase: 0.18, alphaBeat: 0.12, slices: 5, colorKey: "primary", motion: { type: "sweep", axis: "x", speed: 0.2, amp: 0.15 }, drawOrder: 5 },
  { id: "aud-2", type: "观众灯", fixtureX: 0.92, fixtureY: 0.06, targetX: 0.85, targetY: 0.95, topWidth: 5, botWidth: 100, alphaBase: 0.18, alphaBeat: 0.12, slices: 5, colorKey: "secondary", motion: { type: "sweep", axis: "x", speed: 0.2, amp: 0.15 }, drawOrder: 5 },

  // ── 9. 追光灯 × 2（左右远端，窄长跟踪光柱）──
  { id: "follow-1", type: "追光灯", fixtureX: -0.05, fixtureY: 0.45, targetX: 0.40, targetY: 0.70, topWidth: 2, botWidth: 12, alphaBase: 0.55, alphaBeat: 0.30, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "xy", speed: 0.25, amp: 0.12 }, drawOrder: 40 },
  { id: "follow-2", type: "追光灯", fixtureX: 1.05, fixtureY: 0.45, targetX: 0.60, targetY: 0.70, topWidth: 2, botWidth: 12, alphaBase: 0.55, alphaBeat: 0.30, slices: 7, colorKey: "accent", motion: { type: "sweep", axis: "xy", speed: 0.25, amp: 0.12 }, drawOrder: 40 },

  // ── 10. LED洗墙灯 × 2条（沿LED屏边缘上下洗色）──
  { id: "wash-1", type: "洗墙灯", fixtureX: 0.08, fixtureY: 0.13, targetX: 0.08, targetY: 0.50, topWidth: 6, botWidth: 40, alphaBase: 0.25, alphaBeat: 0.10, slices: 5, colorKey: "primary", motion: { type: "pulse", speed: 0.15, amp: 0.3 }, drawOrder: 15 },
  { id: "wash-2", type: "洗墙灯", fixtureX: 0.92, fixtureY: 0.13, targetX: 0.92, targetY: 0.50, topWidth: 6, botWidth: 40, alphaBase: 0.25, alphaBeat: 0.10, slices: 5, colorKey: "secondary", motion: { type: "pulse", speed: 0.15, amp: 0.3 }, drawOrder: 15 },
];

export function KtvStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const prevMoodRef = useRef<MoodType>("warm");
  const prevColorRef = useRef({ ...MOOD.warm });
  const moodChangeRef = useRef(0);
  const camRef = useRef({ scale: 1, panX: 0, panY: 0 });
  const drawRef = useRef<((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void) | null>(null);

  drawRef.current = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const s = useAudioAnalyzer.getState();
    const beat = s.isPlaying ? s.beat : Math.sin(t * 2) * 0.3 + 0.3;
    const energy = s.isPlaying ? s.energy : 0.3;
    const autoMood: MoodType = s.isPlaying ? s.mood : "warm";
    const lockedMood = useMoodLock.getState().lockedMood;
    const moodKey: MoodType = lockedMood || autoMood;
    const freq = s.isPlaying ? s.freqBoosted : new Uint8Array(0);
    const audioBands = s.isPlaying ? { energy: s.energy, bass: s.bass, mid: s.mid, high: s.high } : null;

    const transition = useKtvTransition.getState();
    transition.tick(t);
    const fi = transition.intensity;

    // 段落强度
    let si: number;
    if (!s.isPlaying) si = 0.5;
    else if (energy > 0.55) si = 1.0;
    else if (energy > 0.35) si = 0.7;
    else if (energy < 0.15) si = 0.3;
    else si = 0.5;

    // 颜色过渡
    if (moodKey !== prevMoodRef.current) {
      prevColorRef.current = { ...prevColorRef.current };
      prevMoodRef.current = moodKey;
      moodChangeRef.current = t;
    }
    const blend = Math.min(1, (t - moodChangeRef.current) / 2);
    const target = MOOD[moodKey];
    const prev = prevColorRef.current;
    const c = {
      primary: lerpC(prev.primary, target.primary, blend),
      secondary: lerpC(prev.secondary, target.secondary, blend),
      accent: lerpC(prev.accent, target.accent, blend),
    };

    // 镜头微动
    const cam = camRef.current;
    cam.scale = lerp(cam.scale, lerp(1.02, 0.98, energy), 0.02);
    cam.panX = lerp(cam.panX, Math.sin(t * 0.15) * w * 0.008, 0.02);
    cam.panY = lerp(cam.panY, Math.cos(t * 0.12) * h * 0.005, 0.02);

    ctx.save();
    ctx.translate(w / 2 + cam.panX, h / 2 + cam.panY);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-w / 2, -h / 2);

    // ═══ 绘制（按层级） ═══
    drawStageBackground(ctx, w, h, c, si, fi);
    drawFloor(ctx, w, h, c, energy, si, fi, beat);
    drawLedWall(ctx, w, h, t, c, energy, si, fi, beat, freq, audioBands);
    drawTruss(ctx, w, h, c, energy, fi);
    drawAllLights(ctx, w, h, t, c, beat, energy, si, fi);
    drawBeatFlash(ctx, w, h, beat, c, fi, si);
    drawParticles(ctx, w, h, t, c, energy, si, fi);
    drawFog(ctx, w, h, t, c, energy, si, fi);
    drawVignette(ctx, w, h);

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const loop = (now: number) => {
      drawRef.current?.(ctx, window.innerWidth, window.innerHeight, now * 0.001);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 1 }} />
  );
}

// ═══════════════════════════════════════════════════════════
// 1. 背景氛围
// ═══════════════════════════════════════════════════════════
function drawStageBackground(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  si: number, fi: number,
) {
  const a = fi;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.55);
  g.addColorStop(0, rgba(c.primary, 0.3 * a));
  g.addColorStop(0.5, rgba(c.secondary, 0.12 * a));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════════
// 2. 舞台地面
// ═══════════════════════════════════════════════════════════
function drawFloor(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  energy: number, si: number, fi: number, beat: number,
) {
  const fy = h * 0.66;
  const fh = h * 0.34;
  const a = si * fi;

  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(0, fy, w, fh);

  // 反射光
  const rg = ctx.createLinearGradient(0, fy, 0, fy + fh * 0.5);
  rg.addColorStop(0, rgba(c.primary, 0.12 * a));
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, fy, w, fh * 0.5);

  // 地砖网格
  ctx.strokeStyle = rgba(c.accent, 0.05 * a);
  ctx.lineWidth = 0.5;
  for (let r = 0; r < 12; r++) {
    const ry = fy + (fh * r) / 12;
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(w, ry); ctx.stroke();
  }
  for (let c2 = 0; c2 < 20; c2++) {
    const rx = (w * c2) / 20;
    ctx.beginPath(); ctx.moveTo(rx, fy); ctx.lineTo(rx, h); ctx.stroke();
  }

  // 前沿接缝线
  ctx.strokeStyle = rgba(c.accent, 0.4 * a);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(w, fy); ctx.stroke();

  const sg = ctx.createLinearGradient(0, fy - 12, 0, fy + 12);
  sg.addColorStop(0, "rgba(0,0,0,0)");
  sg.addColorStop(0.5, rgba(c.accent, 0.15 * a));
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, fy - 12, w, 24);
}

// ═══════════════════════════════════════════════════════════
// 3. LED 墙
// ═══════════════════════════════════════════════════════════
function drawLedWall(
  ctx: CanvasRenderingContext2D, w: number, h: number, t: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  energy: number, si: number, fi: number, beat: number, freq: Uint8Array,
  audioBands: { energy: number; bass: number; mid: number; high: number } | null,
) {
  const a = si * fi;

  // ── 中央大屏 ──
  const cw = w * 0.44, ch = h * 0.44;
  const cx = (w - cw) / 2, cy = h * 0.16;

  // 外发光
  const og = ctx.createRadialGradient(cx + cw / 2, cy + ch / 2, cw * 0.3, cx + cw / 2, cy + ch / 2, cw * 0.7);
  og.addColorStop(0, rgba(c.primary, 0.12 * a));
  og.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = og;
  ctx.fillRect(cx - w * 0.08, cy - h * 0.05, cw + w * 0.16, ch + h * 0.1);

  ctx.fillStyle = "rgba(5, 5, 12, 0.95)";
  ctx.fillRect(cx, cy, cw, ch);

  ctx.strokeStyle = rgba(c.accent, 0.5 * a);
  ctx.lineWidth = 3;
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.strokeStyle = rgba(c.accent, 0.12 * a);
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 8, cy + 8, cw - 16, ch - 16);

  // ── 左副屏（律动波形）──
  const sw = w * 0.13, sh = h * 0.38;
  const lx = cx - sw - w * 0.04, ly = cy + h * 0.03;
  drawSubScreen(ctx, lx, ly, sw, sh, c, a, beat, energy, freq, t, audioBands);

  // ── 右副屏（律动波形）──
  const rx = cx + cw + w * 0.04;
  drawSubScreen(ctx, rx, ly, sw, sh, c, a, beat, energy, freq, t, audioBands);
}

// ── 副屏：律动波形（从底部升起的柱状波形，随节拍跳动）──
function drawSubScreen(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  a: number, beat: number, energy: number, freq: Uint8Array, t: number,
  audioBands: { energy: number; bass: number; mid: number; high: number } | null,
) {
  // 暗底
  ctx.fillStyle = "rgba(5, 5, 12, 0.92)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgba(c.accent, 0.4 * a);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  const barCount = 18;
  const gap = 2;
  const barW = (w - 14 - gap * (barCount - 1)) / barCount;
  const maxBarH = h * 0.78;
  const bottomY = y + h - 6;

  for (let i = 0; i < barCount; i++) {
    const p = i / (barCount - 1);
    let val: number;

    if (audioBands) {
      // 每根柱子有独立的随机频率组合，高低不一
      const seed = i * 137.5 + 42; // 每根柱子不同的种子偏移
      const r1 = Math.sin(seed + t * (1.3 + i * 0.17)) * 0.35;
      const r2 = Math.sin(seed * 1.7 + t * (2.1 + i * 0.11)) * 0.25;
      const r3 = Math.sin(seed * 0.7 + t * (0.8 + i * 0.23)) * 0.15;
      const randomH = 0.45 + r1 + r2 + r3; // 0~0.9 左右独立波动

      // 频段数据做微弱调制，让整体跟音乐有联动但不主导
      let bandMod = 1;
      if (p < 0.2) bandMod = 0.8 + audioBands.bass * 0.5;
      else if (p < 0.5) bandMod = 0.8 + audioBands.mid * 0.5;
      else if (p < 0.8) bandMod = 0.8 + audioBands.high * 0.5;
      else bandMod = 0.8 + audioBands.energy * 0.5;

      val = clamp(randomH * bandMod, 0, 1);
    } else {
      // 无音频：柱子全部静止在底部
      val = 0.04;
    }

    // beat 踢一下
    val = clamp(val + beat * 0.35, 0, 1);

    const barH = Math.max(4, val * maxBarH);
    const bx = x + 7 + i * (barW + gap);
    const by = bottomY - barH;

    // 渐变色：底部 primary → 中部 secondary → 顶部 accent
    const bg = ctx.createLinearGradient(bx, bottomY, bx, by);
    bg.addColorStop(0, rgba(c.primary, 0.3 * a));
    bg.addColorStop(0.45, rgba(c.secondary, 0.55 * a));
    bg.addColorStop(1, rgba(c.accent, 0.8 * a));
    ctx.fillStyle = bg;

    // 圆角矩形
    const radius = Math.min(barW / 2, 3);
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.lineTo(bx + barW - radius, by);
    ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + radius);
    ctx.lineTo(bx + barW, bottomY);
    ctx.lineTo(bx, bottomY);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.closePath();
    ctx.fill();

    // 顶部亮点
    if (barH > 10) {
      const tg = ctx.createRadialGradient(bx + barW / 2, by, 0, bx + barW / 2, by, barW * 1.2);
      tg.addColorStop(0, rgba([255, 255, 255], 0.45 * a));
      tg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = tg;
      ctx.fillRect(bx - 2, by - 4, barW + 4, 10);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 4. 桁架
// ═══════════════════════════════════════════════════════════
function drawTruss(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  energy: number, fi: number,
) {
  const a = fi;
  const ty = h * 0.06;
  const plx = w * 0.05, prx = w * 0.95;
  const midY = ty + h * 0.02;

  // 暗色厚底
  ctx.strokeStyle = rgba([20, 20, 40], 0.95);
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(plx, ty);
  ctx.quadraticCurveTo(w * 0.5, midY, prx, ty);
  ctx.stroke();

  // 金属面
  const bm = ctx.createLinearGradient(0, ty - 6, 0, ty + 6);
  bm.addColorStop(0, rgba(c.accent, 0.25 * a));
  bm.addColorStop(0.5, rgba(c.accent, 0.45 * a));
  bm.addColorStop(1, rgba(c.accent, 0.15 * a));
  ctx.strokeStyle = bm;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(plx, ty);
  ctx.quadraticCurveTo(w * 0.5, midY, prx, ty);
  ctx.stroke();

  // 侧立柱
  drawPillar(ctx, plx + w * 0.015, h * 0.70, plx, ty, c, a);
  drawPillar(ctx, prx - w * 0.015, h * 0.70, prx, ty, c, a);

  // 铆钉
  for (let i = 0; i < 9; i++) {
    const nx = w * (0.1 + i * 0.1);
    const p = (nx - plx) / (prx - plx);
    const ny = ty + Math.sin(p * Math.PI) * (midY - ty);

    ctx.fillStyle = rgba(c.accent, 0.6 * a);
    ctx.beginPath();
    ctx.arc(nx, ny, 5, 0, Math.PI * 2);
    ctx.fill();

    const dg = ctx.createRadialGradient(nx, ny, 0, nx, ny, 16);
    dg.addColorStop(0, rgba(c.accent, 0.3 * a));
    dg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(nx, ny, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPillar(
  ctx: CanvasRenderingContext2D, bx: number, by: number, tx: number, ty: number,
  c: { primary: number[]; secondary: number[]; accent: number[] }, a: number,
) {
  ctx.strokeStyle = rgba([15, 15, 30], 0.95);
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();

  const pg = ctx.createLinearGradient(tx - 5, 0, tx + 5, 0);
  pg.addColorStop(0, rgba(c.accent, 0.12 * a));
  pg.addColorStop(0.5, rgba(c.accent, 0.35 * a));
  pg.addColorStop(1, rgba(c.accent, 0.12 * a));
  ctx.strokeStyle = pg;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();

  ctx.strokeStyle = rgba(c.accent, 0.1 * a);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const t1 = i / 5, t2 = (i + 1) / 5;
    const x1 = lerp(tx, bx, t1), y1 = lerp(ty, by, t1);
    const x2 = lerp(tx, bx, t2), y2 = lerp(ty, by, t2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lerp(tx, bx, t2), y1); ctx.lineTo(lerp(tx, bx, t1), y2); ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════
// 5. 烟雾大气层
// ═══════════════════════════════════════════════════════════
function drawFog(
  ctx: CanvasRenderingContext2D, w: number, h: number, t: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  energy: number, si: number, fi: number,
) {
  const a = fi;
  ctx.globalCompositeOperation = 'lighter';

  const fogSpots = [
    { cx: 0.2, cy: 0.35, r: 0.45, color: c.primary, alpha: 0.05, driftX: 0.08, driftY: 0.03 },
    { cx: 0.75, cy: 0.3, r: 0.5, color: c.secondary, alpha: 0.04, driftX: -0.06, driftY: 0.04 },
    { cx: 0.5, cy: 0.5, r: 0.55, color: c.accent, alpha: 0.03, driftX: 0.03, driftY: -0.02 },
    { cx: 0.35, cy: 0.6, r: 0.4, color: c.primary, alpha: 0.04, driftX: -0.04, driftY: -0.03 },
  ];

  for (const f of fogSpots) {
    const fx = f.cx + Math.sin(t * 0.3 + f.cx * 10) * f.driftX;
    const fy = f.cy + Math.cos(t * 0.25 + f.cy * 8) * f.driftY;
    const g = ctx.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, w * f.r);
    g.addColorStop(0, rgba(f.color, f.alpha * a * (0.8 + energy * 0.4)));
    g.addColorStop(0.6, rgba(f.color, f.alpha * 0.4 * a));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════════
// 6. 统一灯光渲染引擎（核心）
// ═══════════════════════════════════════════════════════════
function drawAllLights(
  ctx: CanvasRenderingContext2D, w: number, h: number, t: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  beat: number, energy: number, si: number, fi: number,
) {
  // 按 drawOrder 排序后分层绘制
  const sorted = [...LIGHTS].sort((a, b) => a.drawOrder - b.drawOrder);

  for (const light of sorted) {
    // 计算灯具与目标的实际坐标
    let fx = light.fixtureX * w;
    let fy = light.fixtureY * h;
    let tx = light.targetX * w;
    let ty = light.targetY * h;

    // 应用运动
    let motionAlphaMul = 1;
    const motion = light.motion;
    if (motion.type === "sweep") {
      const sweepVal = Math.sin(t * motion.speed + light.fixtureX * 10) * motion.amp;
      if (motion.axis === "x" || motion.axis === "xy") tx += sweepVal * w;
      if (motion.axis === "xy") ty += Math.sin(t * motion.speed * 0.7 + light.fixtureY * 8) * motion.amp * h * 0.5;
    } else if (motion.type === "pulse") {
      const pulseVal = Math.sin(t * motion.speed) * motion.amp;
      motionAlphaMul = 1 + pulseVal;
    } else if (motion.type === "chase") {
      const chasePhase = (t * motion.speed + light.fixtureX * 5) % (Math.PI * 2);
      motionAlphaMul = 0.3 + (Math.sin(chasePhase) * 0.5 + 0.5) * 0.7;
    }

    const color = c[light.colorKey];
    const beatKick = beat * light.alphaBeat * si;
    const baseA = light.alphaBase * fi * motionAlphaMul;
    const totalA = clamp(baseA + beatKick * fi, 0, 1);

    if (totalA < 0.01) continue;

    // 计算光束几何
    const dx = tx - fx, dy = ty - fy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    const topW = light.topWidth;
    const botW = light.botWidth;
    const slices = light.slices;

    ctx.globalCompositeOperation = 'lighter';

    // 绘制光束切片
    const halfSlices = Math.floor(slices / 2);
    for (let s = -halfSlices; s <= halfSlices; s++) {
      const norm = halfSlices === 0 ? 0 : s / halfSlices;
      const gauss = Math.exp(-(norm * norm) * 2);
      const sliceBotOff = norm * botW * 0.9;
      const sliceTopOff = norm * topW * 0.9;

      const topX0 = fx - perpX * (topW * 0.5) + perpX * sliceTopOff;
      const topY0 = fy - perpY * (topW * 0.5) + perpY * sliceTopOff;
      const topX1 = fx + perpX * (topW * 0.5) + perpX * sliceTopOff;
      const topY1 = fy + perpY * (topW * 0.5) + perpY * sliceTopOff;

      const botX0 = tx - perpX * (botW * 0.5) + perpX * sliceBotOff;
      const botY0 = ty - perpY * (botW * 0.5) + perpY * sliceBotOff;
      const botX1 = tx + perpX * (botW * 0.5) + perpX * sliceBotOff;
      const botY1 = ty + perpY * (botW * 0.5) + perpY * sliceBotOff;

      ctx.beginPath();
      ctx.moveTo(topX0, topY0);
      ctx.lineTo(topX1, topY1);
      ctx.lineTo(botX1, botY1);
      ctx.lineTo(botX0, botY0);
      ctx.closePath();

      const sliceGrd = ctx.createLinearGradient(fx, fy, tx, ty);
      const sa = gauss * totalA;
      sliceGrd.addColorStop(0, rgba([255, 255, 255], sa * 0.9));
      sliceGrd.addColorStop(0.15, rgba(color, sa * 0.7));
      sliceGrd.addColorStop(0.5, rgba(color, sa * 0.35));
      sliceGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sliceGrd;
      ctx.fill();
    }

    // 外层柔光（宽光锥）
    ctx.beginPath();
    ctx.moveTo(fx - perpX * topW * 2, fy - perpY * topW * 2);
    ctx.lineTo(fx + perpX * topW * 2, fy + perpY * topW * 2);
    ctx.lineTo(tx + perpX * (botW * 1.8), ty + perpY * (botW * 1.8));
    ctx.lineTo(tx - perpX * (botW * 1.8), ty - perpY * (botW * 1.8));
    ctx.closePath();
    const outerGrd = ctx.createLinearGradient(fx, fy, tx, ty);
    outerGrd.addColorStop(0, rgba(color, totalA * 0.35));
    outerGrd.addColorStop(0.3, rgba(color, totalA * 0.15));
    outerGrd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = outerGrd;
    ctx.fill();

    // 落地光斑
    if (ty > h * 0.5) {
      const spotR = botW * 1.2;
      const sg = ctx.createRadialGradient(tx, ty, 0, tx, ty, spotR);
      sg.addColorStop(0, rgba([255, 255, 255], totalA * 0.4));
      sg.addColorStop(0.3, rgba(color, totalA * 0.25));
      sg.addColorStop(0.7, rgba(color, totalA * 0.08));
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(tx, ty, spotR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 灯头发光点
    const dotR = 6 + beat * 8;
    const dg = ctx.createRadialGradient(fx, fy, 0, fx, fy, dotR);
    dg.addColorStop(0, rgba([255, 255, 255], totalA * 0.9));
    dg.addColorStop(0.3, rgba(color, totalA * 0.6));
    dg.addColorStop(0.6, rgba(color, totalA * 0.25));
    dg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(fx, fy, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }
}

// ═══════════════════════════════════════════════════════════
// 7. Beat 闪光
// ═══════════════════════════════════════════════════════════
function drawBeatFlash(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  beat: number, c: { primary: number[]; secondary: number[]; accent: number[] }, fi: number, si: number,
) {
  if (beat < 0.2) return;
  const a = fi;
  const cx = w * 0.5, cy = h * 0.45;
  const flashA = (beat - 0.2) * 0.5 * a;

  ctx.globalCompositeOperation = 'lighter';

  const pulseR = w * (0.15 + beat * 0.4);

  const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR * 0.4);
  g1.addColorStop(0, rgba([255, 255, 255], flashA * 0.8));
  g1.addColorStop(0.5, rgba(c.accent, flashA * 0.3));
  g1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(cx - pulseR, cy - pulseR, pulseR * 2, pulseR * 2);

  const g2 = ctx.createRadialGradient(cx, cy, pulseR * 0.3, cx, cy, pulseR);
  g2.addColorStop(0, "rgba(0,0,0,0)");
  g2.addColorStop(0.3, rgba(c.primary, flashA * 0.4));
  g2.addColorStop(0.6, rgba(c.secondary, flashA * 0.2));
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(cx - pulseR, cy - pulseR, pulseR * 2, pulseR * 2);

  ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════════
// 8. 粒子
// ═══════════════════════════════════════════════════════════
function drawParticles(
  ctx: CanvasRenderingContext2D, w: number, h: number, t: number,
  c: { primary: number[]; secondary: number[]; accent: number[] },
  energy: number, si: number, fi: number,
) {
  const count = Math.floor(12 + si * 12);
  const a = fi;

  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const x = w * (0.15 + (Math.sin(seed + t * 0.05) * 0.5 + 0.5) * 0.7);
    const y = h * (0.15 + (Math.cos(seed * 0.7 + t * 0.04) * 0.5 + 0.5) * 0.5);
    const size = 1.5 + Math.sin(t * 0.3 + i) * 0.8 + energy * 1;
    const pa = (0.3 + Math.sin(t * 0.2 + i * 0.4) * 0.1 + energy * 0.1) * a;

    const pg = ctx.createRadialGradient(x, y, 0, x, y, size * 3.5);
    pg.addColorStop(0, rgba(c.accent, pa));
    pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(x, y, size * 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = rgba([255, 255, 255], pa * 1.8);
    ctx.beginPath(); ctx.arc(x, y, size * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ═══════════════════════════════════════════════════════════
// 9. 暗角
// ═══════════════════════════════════════════════════════════
function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.25, w * 0.5, h * 0.5, w * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.6, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
