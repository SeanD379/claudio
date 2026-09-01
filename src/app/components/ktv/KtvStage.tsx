"use client";

import { useEffect, useRef } from "react";
import { useAudioAnalyzer, type MoodType } from "@/hooks/useAudioAnalyzer";
import { useMoodLock } from "@/hooks/useMoodLock";
import { useTheme } from "@/hooks/useTheme";
import { getStageMotion } from "@/app/lib/ktv-stage-motion";

const MOOD: Record<MoodType, { primary: number[]; secondary: number[]; accent: number[] }> = {
  minimal: { primary: [140, 160, 210], secondary: [100, 120, 170], accent: [190, 200, 230] },
  warm: { primary: [230, 175, 100], secondary: [200, 140, 70], accent: [245, 210, 160] },
  cyber: { primary: [200, 110, 155], secondary: [170, 90, 130], accent: [225, 170, 200] },
  tech: { primary: [80, 150, 210], secondary: [60, 120, 180], accent: [150, 200, 240] },
  redGold: { primary: [210, 145, 70], secondary: [180, 110, 50], accent: [235, 195, 130] },
  rainbow: { primary: [150, 110, 190], secondary: [120, 85, 160], accent: [190, 160, 220] },
};

type Colors = { primary: number[]; secondary: number[]; accent: number[] };
type Motion = { cycleSpeed: number; density: number };

function rgba(color: number[], alpha: number) {
  return `rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${alpha})`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function pixel(value: number) {
  return Math.round(value);
}

export function KtvStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const hiddenRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const drawRef = useRef<((ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawRef.current = (drawCtx, w, h, now) => {
      const audio = useAudioAnalyzer.getState();
      const dynamicBg = useTheme.getState().dynamicBg;
      const isAnimated = dynamicBg && !reducedMotionRef.current;
      const energy = audio.isPlaying ? audio.energy : 0.3;
      const bass = audio.isPlaying ? audio.bass : 0;
      const mid = audio.isPlaying ? audio.mid : 0;
      const high = audio.isPlaying ? audio.high : 0;
      const motion = getStageMotion({ bpm: audio.bpm, bpmConfident: audio.bpmConfident, energy });
      const time = isAnimated ? now * motion.cycleSpeed : 0;
      const beatPulse = isAnimated && audio.isPlaying ? clamp(audio.beat, 0, 0.35) : 0;
      const autoMood: MoodType = audio.isPlaying ? audio.mood : "warm";
      const moodKey: MoodType = useMoodLock.getState().lockedMood || autoMood;
      const colors = MOOD[moodKey];

      drawCtx.clearRect(0, 0, w, h);
      drawStageBackground(drawCtx, w, h, colors, bass);
      drawLyricHalo(drawCtx, w, h, colors, bass, beatPulse, motion.density);
      drawLightBeams(drawCtx, w, h, time, colors, mid, beatPulse, motion.density);
      drawCircularStage(drawCtx, w, h, colors, bass, beatPulse);
      drawMusicians(drawCtx, w, h, colors);
      drawSinger(drawCtx, w, h, colors, beatPulse);
      drawAudience(drawCtx, w, h, colors, beatPulse, motion.density);
      if (isAnimated) drawParticles(drawCtx, w, h, time, colors, high, motion);
      drawVignette(drawCtx, w, h);
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setReducedMotion = () => { reducedMotionRef.current = media.matches; };
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const onVisibilityChange = () => { hiddenRef.current = document.hidden; };
    const loop = (now: number) => {
      if (!hiddenRef.current) drawRef.current?.(ctx, window.innerWidth, window.innerHeight, now * 0.001);
      rafRef.current = requestAnimationFrame(loop);
    };

    setReducedMotion();
    resize();
    onVisibilityChange();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    media.addEventListener("change", setReducedMotion);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      media.removeEventListener("change", setReducedMotion);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 1 }} />;
}

function drawStageBackground(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors, bass: number) {
  ctx.fillStyle = "#05050c";
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.53, 0, w * 0.5, h * 0.53, w * 0.65);
  glow.addColorStop(0, rgba(colors.secondary, 0.12 + bass * 0.08));
  glow.addColorStop(0.5, rgba(colors.primary, 0.045));
  glow.addColorStop(1, "rgba(5,5,12,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawLyricHalo(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors, bass: number, pulse: number, density: number) {
  const centerX = w * 0.5;
  const haloY = h * 0.22;
  const haloRadiusX = w * 0.3;
  const haloRadiusY = h * 0.075;
  const edgeAlpha = 0.25 + bass * 0.16 + pulse * 0.28;

  ctx.fillStyle = rgba(colors.secondary, 0.1 + bass * 0.08);
  ctx.beginPath();
  ctx.ellipse(centerX, haloY, haloRadiusX + 7, haloRadiusY + 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(5, 5, 12, 0.82)";
  ctx.beginPath();
  ctx.ellipse(centerX, haloY, haloRadiusX, haloRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, edgeAlpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(centerX, haloY, haloRadiusX + 3, haloRadiusY + 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  const markers = Math.floor(16 + density * 8);
  ctx.fillStyle = rgba(colors.primary, 0.22 + pulse * 0.3);
  for (let i = 0; i < markers; i++) {
    const angle = (i / markers) * Math.PI * 2;
    const x = pixel(centerX + Math.cos(angle) * (haloRadiusX + 9));
    const y = pixel(haloY + Math.sin(angle) * (haloRadiusY + 9));
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

function drawLightBeams(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, colors: Colors, mid: number, pulse: number, density: number) {
  const sweepAmplitude = 0.03 + mid * 0.07;
  const sources = [0.19, 0.33, 0.67, 0.81];
  const targets = [0.3, 0.42, 0.58, 0.7];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < sources.length; i++) {
    const sway = Math.sin(time * 0.72 + i * 1.7) * sweepAmplitude * w;
    const sourceX = pixel(sources[i] * w);
    const targetX = pixel(targets[i] * w + sway);
    const sourceY = pixel(h * 0.115);
    const targetY = pixel(h * (0.52 + (i % 2) * 0.035));
    const width = pixel(34 + density * 22);
    const gradient = ctx.createLinearGradient(sourceX, sourceY, targetX, targetY);
    gradient.addColorStop(0, rgba(colors.accent, 0.17 + pulse * 0.14));
    gradient.addColorStop(0.42, rgba(i % 2 ? colors.secondary : colors.primary, 0.055 + mid * 0.09));
    gradient.addColorStop(1, "rgba(5,5,12,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(sourceX - 2, sourceY);
    ctx.lineTo(sourceX + 2, sourceY);
    ctx.lineTo(targetX + width, targetY);
    ctx.lineTo(targetX - width, targetY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(colors.accent, 0.28 + pulse * 0.22);
    ctx.fillRect(sourceX - 2, sourceY - 2, 5, 5);
  }
  ctx.restore();
}

function drawCircularStage(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors, bass: number, pulse: number) {
  const centerX = w * 0.5;
  const stageY = h * 0.61;
  const stageRadiusX = w * 0.24;
  const stageRadiusY = h * 0.075;
  const ringAlpha = 0.18 + bass * 0.24 + pulse * 0.3;

  const floorGlow = ctx.createRadialGradient(centerX, stageY, stageRadiusY, centerX, stageY, stageRadiusX * 1.24);
  floorGlow.addColorStop(0, rgba(colors.primary, 0.07 + bass * 0.12));
  floorGlow.addColorStop(0.55, rgba(colors.secondary, 0.025 + bass * 0.06));
  floorGlow.addColorStop(1, "rgba(5,5,12,0)");
  ctx.fillStyle = floorGlow;
  ctx.fillRect(pixel(centerX - stageRadiusX * 1.35), pixel(stageY - stageRadiusY * 3), pixel(stageRadiusX * 2.7), pixel(stageRadiusY * 6));

  ctx.fillStyle = "#0b0b16";
  ctx.beginPath();
  ctx.ellipse(centerX, stageY, stageRadiusX, stageRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(colors.primary, ringAlpha);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(centerX, stageY, stageRadiusX + 3, stageRadiusY + 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(colors.accent, 0.13 + bass * 0.12 + pulse * 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(centerX, stageY, stageRadiusX * 0.79, stageRadiusY * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = rgba(colors.secondary, 0.17 + bass * 0.1);
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    const x = pixel(centerX + Math.cos(angle) * (stageRadiusX + 8));
    const y = pixel(stageY + Math.sin(angle) * (stageRadiusY + 8));
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

function drawSinger(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors, pulse: number) {
  const x = pixel(w * 0.5);
  const baseY = pixel(h * 0.632);
  ctx.fillStyle = rgba(colors.accent, 0.12 + pulse * 0.22);
  ctx.fillRect(x - 11, baseY - 45, 23, 42);
  ctx.fillStyle = "#090912";
  ctx.fillRect(x - 5, baseY - 51, 11, 10);
  ctx.fillRect(x - 7, baseY - 40, 15, 25);
  ctx.fillRect(x - 10, baseY - 17, 8, 15);
  ctx.fillRect(x + 3, baseY - 17, 8, 15);
  ctx.fillRect(x + 7, baseY - 35, 8, 4);
  ctx.fillStyle = rgba(colors.accent, 0.48 + pulse * 0.28);
  ctx.fillRect(x + 14, baseY - 36, 7, 2);
}

function drawMusicians(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors) {
  const baseY = pixel(h * 0.625);
  const musicians = [
    { x: 0.32, kind: "keys" },
    { x: 0.4, kind: "drums" },
    { x: 0.6, kind: "guitar" },
    { x: 0.68, kind: "bass" },
  ];

  ctx.fillStyle = "#090912";
  for (const musician of musicians) {
    const x = pixel(w * musician.x);
    ctx.fillRect(x - 3, baseY - 30, 7, 7);
    ctx.fillRect(x - 5, baseY - 23, 11, 18);
    ctx.fillRect(x - 7, baseY - 7, 5, 9);
    ctx.fillRect(x + 3, baseY - 7, 5, 9);
    ctx.fillStyle = rgba(colors.secondary, 0.34);
    if (musician.kind === "drums") {
      ctx.fillRect(x - 15, baseY - 10, 11, 7);
      ctx.fillRect(x + 5, baseY - 10, 11, 7);
      ctx.fillRect(x - 11, baseY - 17, 23, 2);
    } else if (musician.kind === "keys") {
      ctx.fillRect(x - 18, baseY - 14, 35, 5);
      ctx.fillRect(x - 14, baseY - 9, 2, 10);
      ctx.fillRect(x + 11, baseY - 9, 2, 10);
    } else {
      ctx.fillRect(x + 5, baseY - 19, 20, 3);
      ctx.fillRect(x + 19, baseY - 22, 7, 8);
    }
    ctx.fillStyle = "#090912";
  }
}

function drawAudience(ctx: CanvasRenderingContext2D, w: number, h: number, colors: Colors, pulse: number, density: number) {
  const rows = 2;
  const perRow = Math.floor(13 + density * 7);
  for (let row = 0; row < rows; row++) {
    const y = pixel(h * (0.735 + row * 0.034));
    for (let i = 0; i < perRow; i++) {
      const offset = row === 0 ? 0.5 : 0;
      const x = pixel(w * ((i + offset) / perRow));
      const size = row === 0 ? 4 : 6;
      ctx.fillStyle = "#080810";
      ctx.fillRect(x - size / 2, y - size * 2, size, size);
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
      if ((i + row) % 5 === 0) {
        ctx.fillStyle = rgba(colors.accent, 0.16 + pulse * 0.32);
        ctx.fillRect(x - 1, y - size * 2 - 5, 3, 3);
      }
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, colors: Colors, high: number, motion: Motion) {
  const count = Math.min(20, Math.floor(4 + high * 10 + motion.density * 6));
  ctx.fillStyle = rgba(colors.accent, 0.28);
  for (let i = 0; i < count; i++) {
    const seed = i * 31.7;
    const x = pixel(w * (0.2 + ((Math.sin(seed + time * 0.55) + 1) * 0.3)));
    const y = pixel(h * (0.31 + ((Math.cos(seed * 0.7 + time * 0.42) + 1) * 0.12)));
    const size = i % 3 === 0 ? 3 : 2;
    ctx.fillRect(x, y, size, size);
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.48, w * 0.2, w * 0.5, h * 0.48, w * 0.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.7, "rgba(0,0,0,0.1)");
  vignette.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}
