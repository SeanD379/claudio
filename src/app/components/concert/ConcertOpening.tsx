"use client";

import { useEffect, useRef } from "react";

const DURATION = 6.0;

// helpers
function clamp(v: number, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp(t); }
function easeOut(t: number) { return 1 - Math.pow(1 - clamp(t), 3); }
function easeInOut(t: number) { return clamp(t) < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// 粒子
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

const COLORS = [
  "rgba(255,240,200,", // warm white
  "rgba(255,210,120,", // gold
  "rgba(180,200,255,", // light blue
  "rgba(255,180,220,", // pink
  "rgba(200,230,255,", // ice blue
];

interface Props {
  onDone: () => void;
}

export function ConcertOpening({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const rafRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setTimeout(() => onDoneRef.current(), 250);
  };

  const skip = () => {
    cancelAnimationFrame(rafRef.current);
    const el = overlayRef.current;
    if (el) {
      el.style.transition = "opacity 0.35s ease-out";
      el.style.opacity = "0";
    }
    finish();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // 生成粒子
    const spawnParticles = (count: number, cx: number, cy: number, speed: number, spread: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = (0.3 + Math.random() * 0.7) * speed;
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * spread,
          y: cy + (Math.random() - 0.5) * spread,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v - 0.3,
          size: 1 + Math.random() * 2.5,
          alpha: 0.6 + Math.random() * 0.4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          life: 0,
          maxLife: 1.5 + Math.random() * 2,
        });
      }
    };

    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const w = W();
      const h = H();
      const cx = w / 2;
      const cy = h * 0.4;

      ctx.clearRect(0, 0, w, h);

      // ── Phase 1: 黑暗序幕 (0-0.8s) ──
      // 桁架轮廓线
      if (t < 4.0) {
        const outlineAlpha = t < 0.8 ? lerp(0, 0.06, t / 0.8) : lerp(0.06, 0.02, (t - 0.8) / 3.2);
        ctx.strokeStyle = `rgba(255,255,255,${outlineAlpha})`;
        ctx.lineWidth = 1;
        // 顶部横梁
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.08);
        ctx.lineTo(w * 0.9, h * 0.08);
        ctx.stroke();
        // 两侧立柱
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.08);
        ctx.lineTo(w * 0.1, h * 0.92);
        ctx.moveTo(w * 0.9, h * 0.08);
        ctx.lineTo(w * 0.9, h * 0.92);
        ctx.stroke();
        // 底部地平线
        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * 0.85);
        ctx.lineTo(w * 0.95, h * 0.85);
        ctx.stroke();
      }

      // ── Phase 2: 第一道光束扫过 (0.8-1.8s) ──
      const beam1Prog = clamp((t - 0.8) / 1.0);
      if (beam1Prog > 0 && beam1Prog < 1.05) {
        const angle = lerp(-0.5, 0.5, easeInOut(beam1Prog));
        const alpha = beam1Prog < 0.9 ? 0.9 : lerp(0.9, 0, (beam1Prog - 0.9) / 0.1);
        drawBeam(ctx, cx, h * 0.08, angle, h * 0.85, alpha, "rgba(255,240,200,");
        // 地面光痕
        const trailAlpha = lerp(0, 0.15, beam1Prog) * (1 - Math.max(0, (t - 1.8) / 1.0));
        if (trailAlpha > 0) {
          ctx.fillStyle = `rgba(255,230,170,${trailAlpha})`;
          ctx.fillRect(w * 0.2, h * 0.84, w * 0.6, h * 0.02);
        }
      }

      // ── Phase 3: 心跳节奏 LED 双闪 (1.5-2.2s) ──
      const heartProg = clamp((t - 1.5) / 0.7);
      if (heartProg > 0 && heartProg < 1.05) {
        // 第一跳：快亮
        const beat1 = clamp((t - 1.5) / 0.08) * (1 - clamp((t - 1.58) / 0.08));
        // 短暂暗
        // 第二跳：慢亮
        const beat2 = clamp((t - 1.72) / 0.12) * (1 - clamp((t - 1.9) / 0.15));
        const beatAlpha = Math.max(beat1, beat2) * 0.5;
        if (beatAlpha > 0.01) {
          // 左 LED 条
          ctx.fillStyle = `rgba(120,160,255,${beatAlpha})`;
          ctx.fillRect(w * 0.06, h * 0.2, w * 0.015, h * 0.45);
          // 右 LED 条
          ctx.fillRect(w * 0.925, h * 0.2, w * 0.015, h * 0.45);
        }
      }

      // ── Phase 4: 三束光同时亮起 (2.2-3.2s) ──
      const beam3Prog = clamp((t - 2.2) / 1.0);
      if (beam3Prog > 0) {
        const alpha = easeOut(beam3Prog) * (t < 4.0 ? 1 : lerp(1, 0, (t - 4.0) / 0.5));
        // 中间光束
        drawBeam(ctx, cx, h * 0.08, 0, h * 0.78, alpha * 0.8, "rgba(255,240,220,");
        // 左光束
        const leftAngle = lerp(0, -0.35, easeOut(beam3Prog));
        drawBeam(ctx, cx, h * 0.08, leftAngle, h * 0.78, alpha * 0.6, "rgba(200,220,255,");
        // 右光束
        const rightAngle = lerp(0, 0.35, easeOut(beam3Prog));
        drawBeam(ctx, cx, h * 0.08, rightAngle, h * 0.78, alpha * 0.6, "rgba(255,200,220,");
      }

      // ── Phase 5: LED 大屏逐块点亮 (3.0-4.0s) ──
      const ledProg = clamp((t - 3.0) / 1.0);
      if (ledProg > 0) {
        // 左屏
        const leftLed = easeOut(clamp((t - 3.0) / 0.4));
        ctx.fillStyle = `rgba(80,120,255,${leftLed * 0.2})`;
        ctx.fillRect(w * 0.06, h * 0.2, w * 0.12, h * 0.45);
        ctx.strokeStyle = `rgba(255,255,255,${leftLed * 0.08})`;
        ctx.strokeRect(w * 0.06, h * 0.2, w * 0.12, h * 0.45);

        // 右屏
        const rightLed = easeOut(clamp((t - 3.15) / 0.4));
        ctx.fillStyle = `rgba(80,120,255,${rightLed * 0.2})`;
        ctx.fillRect(w * 0.82, h * 0.2, w * 0.12, h * 0.45);
        ctx.strokeStyle = `rgba(255,255,255,${rightLed * 0.08})`;
        ctx.strokeRect(w * 0.82, h * 0.2, w * 0.12, h * 0.45);

        // 中央大屏
        const centerLed = easeOut(clamp((t - 3.3) / 0.5));
        ctx.fillStyle = `rgba(60,90,200,${centerLed * 0.18})`;
        ctx.fillRect(w * 0.22, h * 0.18, w * 0.56, h * 0.4);
        ctx.strokeStyle = `rgba(255,255,255,${centerLed * 0.06})`;
        ctx.strokeRect(w * 0.22, h * 0.18, w * 0.56, h * 0.4);

        // 地屏
        const floorLed = easeOut(clamp((t - 3.5) / 0.5));
        ctx.fillStyle = `rgba(80,100,200,${floorLed * 0.2})`;
        ctx.fillRect(w * 0.05, h * 0.82, w * 0.9, h * 0.04);
      }

      // ── Phase 6: 粒子系统 (3.5s+) ──
      // 持续生成飘落粒子
      if (t > 3.5 && t < 5.0) {
        const rate = lerp(0, 3, (t - 3.5) / 1.5);
        if (Math.random() < rate * 0.16) {
          spawnParticles(1, cx, h * 0.3, 0.5, w * 0.6);
        }
      }

      // 爆发时大量粒子 (4.0-4.5s)
      if (t > 4.0 && t < 4.3) {
        spawnParticles(8, cx, cy, 3, 40);
      }

      // 更新和绘制粒子
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 0.016;
        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // 轻微重力
        p.vx *= 0.995;

        const lifeRatio = p.life / p.maxLife;
        const alpha = p.alpha * (1 - lifeRatio * lifeRatio);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + alpha + ")";
        ctx.fill();

        // 光晕
        if (p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color + alpha * 0.15 + ")";
          ctx.fill();
        }
      }

      // ── Phase 7: 汇聚爆发闪光 (4.0-4.5s) ──
      const burstProg = clamp((t - 4.0) / 0.5);
      if (burstProg > 0 && burstProg < 1.05) {
        // 先收拢再爆发
        const burstAlpha = burstProg < 0.3
          ? lerp(0, 0.6, burstProg / 0.3)
          : lerp(0.6, 0, (burstProg - 0.3) / 0.7);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
        grad.addColorStop(0, `rgba(255,250,230,${burstAlpha})`);
        grad.addColorStop(0.3, `rgba(255,220,170,${burstAlpha * 0.5})`);
        grad.addColorStop(1, "rgba(255,200,150,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Phase 8: 全景展开 (4.5-5.5s) ──
      const fullProg = clamp((t - 4.5) / 1.0);
      if (fullProg > 0 && t < 5.5) {
        const spreadAlpha = easeOut(fullProg) * 0.3;
        // 全场环境光
        const envGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
        envGrad.addColorStop(0, `rgba(100,130,220,${spreadAlpha * 0.15})`);
        envGrad.addColorStop(1, "rgba(60,80,160,0)");
        ctx.fillStyle = envGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // ── 跳过提示 (0.5-2s) ──
      const hint = hintRef.current;
      if (hint) {
        hint.style.opacity = (t > 0.5 && t < 2.5) ? "0.35" : "0";
      }

      // ── 完成 ──
      if (t >= DURATION) {
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.style.transition = "opacity 0.4s ease-out";
          overlay.style.opacity = "0";
        }
        finish();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={overlayRef}
      onClick={skip}
      className="fixed inset-0 z-[60] cursor-pointer"
      style={{ opacity: 1, background: "#000" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      />
      {/* 跳过提示 */}
      <div
        ref={hintRef}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white text-xs tracking-widest select-none transition-opacity duration-500"
        style={{ opacity: 0 }}
      >
        点击跳过
      </div>
    </div>
  );
}

// 绘制光束（从顶部向下展开的三角形光锥）
function drawBeam(
  ctx: CanvasRenderingContext2D,
  originX: number, originY: number,
  angle: number, length: number,
  alpha: number, colorPrefix: string,
) {
  if (alpha < 0.005) return;

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  const spread = length * 0.15; // 光束底部宽度

  const grad = ctx.createLinearGradient(0, 0, 0, length);
  grad.addColorStop(0, colorPrefix + (alpha * 0.9) + ")");
  grad.addColorStop(0.3, colorPrefix + (alpha * 0.5) + ")");
  grad.addColorStop(0.7, colorPrefix + (alpha * 0.15) + ")");
  grad.addColorStop(1, colorPrefix + "0)");

  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-spread, length);
  ctx.lineTo(spread, length);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 光束中心高亮
  const coreGrad = ctx.createLinearGradient(0, 0, 0, length * 0.6);
  coreGrad.addColorStop(0, `rgba(255,255,255,${alpha * 0.4})`);
  coreGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(-3, length * 0.6);
  ctx.lineTo(3, length * 0.6);
  ctx.lineTo(1, 0);
  ctx.closePath();
  ctx.fillStyle = coreGrad;
  ctx.fill();

  ctx.restore();
}
