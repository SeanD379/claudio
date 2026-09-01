# KTV 沉浸舞台原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 让 Claudio 的 KTV 模式呈现封面配色的像素风 360° 环形演唱会舞台，并让灯光、环屏与粒子跟随 BPM、鼓点和频段产生克制的动态响应。

**Architecture:** 在现有 Web Audio 分析链中补充节拍时间点与轻量 BPM 估算；纯计算独立放入 \`src/app/lib\`，便于 Node 测试。KTV Canvas 仍是唯一舞台绘制入口；它读取分析数据和动态背景设置，绘制环形舞台、环屏、乐手与观众。歌词组件只负责把现有同步歌词置于上方环屏的安全区域。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、Canvas 2D、Web Audio API、Node \`node:test\`、\`tsx\`。

---

## 文件结构

- Create: \`src/app/lib/ktv-stage-motion.ts\` — BPM 估算与舞美运动参数；不依赖浏览器 API。
- Create: \`src/app/lib/ktv-stage-motion.test.ts\` — 覆盖稳定节拍、无效节拍和参数边界。
- Modify: \`package.json\` — 提供独立测试脚本。
- Modify: \`src/hooks/useAudioAnalyzer.ts\` — 公开 BPM 与置信度，保持原有单条音频输出链。
- Modify: \`src/app/components/ktv/KtvStage.tsx\` — 画 360° 环形像素舞台，接入 BPM、频段、动态背景与可见性控制。
- Modify: \`src/app/components/ktv/KtvLyrics.tsx\` — 让歌词落在环屏预留区域。

### Task 1: 写可测试的 BPM 与舞美速度纯函数

**Files:**
- Create: \`src/app/lib/ktv-stage-motion.ts\`
- Create: \`src/app/lib/ktv-stage-motion.test.ts\`
- Modify: \`package.json\`

- [ ] **Step 1: 写失败测试**

\`\`\`ts
import assert from "node:assert/strict";
import test from "node:test";
import { estimateBpm, getStageMotion } from "./ktv-stage-motion";

test("estimateBpm returns 120 BPM for half-second beats", () => {
  assert.deepEqual(estimateBpm([0, 500, 1000, 1500, 2000, 2500]), {
    bpm: 120,
    confident: true,
  });
});

test("estimateBpm rejects insufficient or invalid beat intervals", () => {
  assert.deepEqual(estimateBpm([0, 0, 30, 5000]), {
    bpm: null,
    confident: false,
  });
});

test("getStageMotion clamps energy and ignores unconfident BPM", () => {
  assert.deepEqual(getStageMotion({ bpm: 128, bpmConfident: true, energy: 2 }), {
    cycleSpeed: 1.07,
    density: 1,
  });
  assert.deepEqual(getStageMotion({ bpm: 128, bpmConfident: false, energy: -1 }), {
    cycleSpeed: 1,
    density: 0.3,
  });
});
\`\`\`

- [ ] **Step 2: 运行并确认失败**

Run: \`npx tsx --test src/app/lib/ktv-stage-motion.test.ts\`

Expected: 因 \`./ktv-stage-motion\` 不存在而失败。

- [ ] **Step 3: 实现最小纯函数**

\`\`\`ts
export interface BpmEstimate {
  bpm: number | null;
  confident: boolean;
}

export function estimateBpm(beatTimesMs: readonly number[]): BpmEstimate {
  const intervals = beatTimesMs
    .slice(1)
    .map((time, index) => time - beatTimesMs[index])
    .filter((interval) => interval >= 250 && interval <= 1000)
    .slice(-8);

  if (intervals.length < 4) return { bpm: null, confident: false };

  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const stable = intervals.filter((interval) => Math.abs(interval - median) <= median * 0.12);
  if (stable.length < 4) return { bpm: null, confident: false };

  const average = stable.reduce((sum, interval) => sum + interval, 0) / stable.length;
  return { bpm: Math.round(60000 / average), confident: true };
}

export function getStageMotion(input: {
  bpm: number | null;
  bpmConfident: boolean;
  energy: number;
}) {
  const density = Math.max(0.3, Math.min(1, input.energy));
  const cycleSpeed = input.bpmConfident && input.bpm
    ? Math.max(0.75, Math.min(1.2, input.bpm / 120))
    : 1;

  return { cycleSpeed: Number(cycleSpeed.toFixed(2)), density };
}
\`\`\`

- [ ] **Step 4: 加入脚本**

在 \`package.json\` 的 \`scripts\` 中保留 \`test:music-history\`，并加入：

\`\`\`json
"test:ktv-stage": "tsx --test src/app/lib/ktv-stage-motion.test.ts"
\`\`\`

- [ ] **Step 5: 验证与提交**

Run: \`npm run test:ktv-stage\`

Expected: 三个子测试均通过，退出码为 0。

\`\`\`bash
git add package.json src/app/lib/ktv-stage-motion.ts src/app/lib/ktv-stage-motion.test.ts
git commit -m "feat: add ktv stage motion timing"
\`\`\`

### Task 2: 在现有分析器中公开稳定 BPM

**Files:**
- Modify: \`src/hooks/useAudioAnalyzer.ts\`
- Test: \`src/app/lib/ktv-stage-motion.test.ts\`

- [ ] **Step 1: 扩展分析状态**

在 \`AudioData\` 的 \`beat\` 后加入：

\`\`\`ts
// 由稳定节拍间隔估算；无可靠值时为 null
bpm: number | null;
// BPM 是否稳定到足以驱动舞美基础速度
bpmConfident: boolean;
\`\`\`

在初始 Zustand 状态中加入：

\`\`\`ts
bpm: null,
bpmConfident: false,
\`\`\`

- [ ] **Step 2: 记录去抖后的节拍时间点**

在 \`init\` 的分析器局部变量中加入：

\`\`\`ts
const beatTimesMs: number[] = [];
let lastBeatAt = 0;
\`\`\`

导入 \`estimateBpm\`。用以下片段替换当前仅按帧计算节拍、紧接着判断情绪的代码：

\`\`\`ts
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
const mood = detectMood(energy, bass, mid, high);
\`\`\`

保持以下线路原样，不能创建第二个媒体源：

\`\`\`ts
source.connect(analyser);
analyser.connect(audioContext.destination);
\`\`\`

- [ ] **Step 3: 暂停与常规更新都返回 BPM 字段**

暂停时使用：

\`\`\`ts
set({
  isPlaying: false,
  energy: 0,
  bass: 0,
  mid: 0,
  high: 0,
  beat: 0,
  bpm: null,
  bpmConfident: false,
  frequency: new Uint8Array(0),
  freqBoosted: new Uint8Array(0),
});
\`\`\`

正常帧的 \`set({ ... })\` 在 \`beat\` 后加入 \`bpm, bpmConfident\`。

- [ ] **Step 4: 验证与提交**

Run: \`npm run test:ktv-stage; npx tsc --noEmit\`

Expected: BPM 测试通过；若全仓 TypeScript 有既有错误，记录路径，并以 \`npx eslint src/hooks/useAudioAnalyzer.ts\` 确认本文件无新问题。

\`\`\`bash
git add src/hooks/useAudioAnalyzer.ts
git commit -m "feat: expose bpm to ktv stage"
\`\`\`

### Task 3: 在 KTV Canvas 中绘制 360° 环形像素舞台

**Files:**
- Modify: \`src/app/components/ktv/KtvStage.tsx\`

- [ ] **Step 1: 读取舞美运动和动态背景设置**

加入导入：

\`\`\`ts
import { getStageMotion } from "@/app/lib/ktv-stage-motion";
import { useTheme } from "@/hooks/useTheme";
\`\`\`

在 \`drawRef.current\` 中，\`audioBands\` 后加入：

\`\`\`ts
const dynamicBg = useTheme.getState().dynamicBg;
const motion = getStageMotion({
  bpm: s.bpm,
  bpmConfident: s.bpmConfident,
  energy,
});
const bass = audioBands?.bass ?? 0;
const mid = audioBands?.mid ?? 0;
const high = audioBands?.high ?? 0;
\`\`\`

当 \`dynamicBg\` 为 false 时，保持静态舞台：将用于绘制的 \`beat\` 设为 0，\`cycleSpeed\` 设为 0，不调用粒子和烟雾漂移；不改现有设置 UI 或保存逻辑。

- [ ] **Step 2: 替换矩形 LED 主屏为环形舞台与歌词环屏**

将 \`drawLedWall\` 替换为 \`drawHaloStage\`，并按此层级调用：

\`\`\`ts
drawStageBackground(ctx, w, h, c, si, fi);
drawAudience(ctx, w, h, c, beat, fi, motion.density);
drawHaloStage(ctx, w, h, t, c, beat, bass, mid, fi);
drawBand(ctx, w, h, c, beat, fi);
drawTruss(ctx, w, h, c, energy, fi);
drawAllLights(ctx, w, h, t * motion.cycleSpeed, c, beat, energy, si, fi);
if (dynamicBg) {
  drawParticles(ctx, w, h, t * motion.cycleSpeed, c, high, si, fi);
  drawFog(ctx, w, h, t * motion.cycleSpeed, c, bass, si, fi);
}
drawVignette(ctx, w, h);
\`\`\`

\`drawHaloStage\` 的几何固定如下：

\`\`\`ts
const centerX = w * 0.5;
const stageY = h * 0.61;
const stageRadiusX = w * 0.24;
const stageRadiusY = h * 0.075;
const haloY = h * 0.22;
const haloRadiusX = w * 0.30;
const haloRadiusY = h * 0.075;
\`\`\`

它依次绘制深色椭圆舞台、alpha 为 \`0.18 + bass * 0.24\` 的低频外圈、小型中央歌手剪影和上方空心环屏。环屏内部固定为 \`rgba(5, 5, 12, 0.82)\`，不写死歌词；像素方块和装饰线取整数坐标，不使用位图背景。

- [ ] **Step 3: 把频段映射限制在安全舞美范围**

使用：

\`\`\`ts
const beatPulse = Math.min(1, beat) * 0.35;
const beamAmplitude = 0.03 + mid * 0.07;
const particleCount = Math.floor(4 + high * 10 + motion.density * 6);
\`\`\`

- BPM 只通过 \`motion.cycleSpeed\` 影响灯束/环带循环速度。
- 鼓点只提高舞台边缘、环屏边框与少量观众灯的亮度，不允许白屏闪烁。
- 低频只扩大舞台地面与环屏底部光晕。
- 中频只调整灯束目标位置，最大振幅为 \`beamAmplitude\`。
- 高频只决定有上限的 \`particleCount\`。
- 继续保留 \`useMoodLock\` 的调色优先级。

- [ ] **Step 4: 添加页面可见性与减弱动态保护**

在 Canvas effect 中使用：

\`\`\`ts
let pageVisible = !document.hidden;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const updateVisibility = () => { pageVisible = !document.hidden; };
document.addEventListener("visibilitychange", updateVisibility);

const loop = (now: number) => {
  if (pageVisible) {
    const time = reducedMotion.matches ? 0 : now * 0.001;
    drawRef.current?.(ctx, window.innerWidth, window.innerHeight, time);
  }
  rafRef.current = requestAnimationFrame(loop);
};
\`\`\`

清理时移除 resize 和 visibility 监听并取消 \`rafRef.current\`。不增加每帧 React state 更新或第二个计时器。

- [ ] **Step 5: 体验验证与提交**

Run: \`npm run dev\`

Verify:
1. 默认听歌模式仍只渲染 SilkBackground、Lyrics、Player。
2. KTV 显示环形舞台、中央歌手、外圈乐手和稀疏观众。
3. 播放时 BPM 控制慢扫；低频带动圆台；中频带动灯束；高频出现少量像素；鼓点只做柔和脉冲。
4. 暂停或关闭“动态背景”时舞台可见但无动态闪烁。
5. 在 375px 宽度没有横向滚动，舞台不压住播放器。

Run: \`npm run test:ktv-stage; npx eslint src/app/components/ktv/KtvStage.tsx src/hooks/useAudioAnalyzer.ts\`

Expected: 退出码为 0。

\`\`\`bash
git add src/app/components/ktv/KtvStage.tsx src/hooks/useAudioAnalyzer.ts
git commit -m "feat: render audio-reactive ktv stage"
\`\`\`

### Task 4: 将同步歌词移到环形屏安全区

**Files:**
- Modify: \`src/app/components/ktv/KtvLyrics.tsx\`

- [ ] **Step 1: 调整歌词定位**

将 \`useLyricsPosition\` 的 \`setPos\` 改为：

\`\`\`ts
setPos({
  left: sw * 0.23,
  top: sh * 0.14,
  width: sw * 0.54,
  height: sh * 0.18,
});
\`\`\`

这会保留环形外框可见，且留出底部 20% 给 \`KtvPlayer\`。

- [ ] **Step 2: 约束长歌词的宽度与字号**

主歌词容器改为：

\`\`\`tsx
className="text-center mx-auto w-full px-6 sm:px-10"
style={{ maxWidth: "900px" }}
\`\`\`

歌词字号改为：

\`\`\`ts
fontSize: "clamp(24px, 3.8vw, 52px)",
\`\`\`

保留已有歌词请求、同步、loading、纯音乐状态、文字阴影和过渡动画。

- [ ] **Step 3: 验证与提交**

Run: \`npm run dev\`

Check 有歌词、无歌词和长歌词歌曲，在桌面与 375px 宽度下均位于深色环屏内部，绝不与播放器重叠。

Run: \`npx eslint src/app/components/ktv/KtvLyrics.tsx\`

Expected: 退出码为 0。

\`\`\`bash
git add src/app/components/ktv/KtvLyrics.tsx
git commit -m "feat: reserve halo screen for ktv lyrics"
\`\`\`

### Task 5: 整体验证和交付检查

**Files:**
- Modify: none, unless前述验证发现直接回归。

- [ ] **Step 1: 运行全部相关检查**

Run: \`npm run test:ktv-stage; npx tsc --noEmit; npx eslint src/app/components/ktv/KtvStage.tsx src/app/components/ktv/KtvLyrics.tsx src/hooks/useAudioAnalyzer.ts\`

Expected: 修改目标均通过；若 \`tsc\` 报告既有无关错误，最终交付中列出文件路径，不改无关代码。

- [ ] **Step 2: 检查变更边界**

Run: \`git diff --check; git status --short; git log --oneline -4\`

Expected: 无空白错误；本功能只涉及上述 source/test/package 文件；提交信息分别对应 BPM、舞台和歌词。

- [ ] **Step 3: 最终体验回归**

先检查默认听歌模式，再进入/退出 KTV；切换全部现有“舞美”锁定项，播放/暂停，开关“动态背景”，并测试桌面/手机宽度。确认默认播放页从未渲染 KTV Canvas，KTV 点歌和队列控制仍可用。

## 自检结果

- **规格覆盖：** Task 1–2 实现稳定 BPM 与回退；Task 3 实现 KTV 专属、像素风环形舞台、封面/情绪调色、BPM/鼓点/频段映射、性能保护与动态背景开关；Task 4 保留同步歌词并预留环屏空间；Task 5 回归默认听歌模式。没有加入 EQ 或十套音效预设，符合本次原型边界。
- **占位扫描：** 不包含 TBD、TODO、稍后实现或“适当处理”等占位；每项改动包含路径、命令和实际片段。
- **类型一致性：** \`BpmEstimate.bpm\` / \`confident\` 映射到 \`AudioData.bpm\` / \`bpmConfident\`，再传入 \`getStageMotion\` 与 Canvas，名称一致。

