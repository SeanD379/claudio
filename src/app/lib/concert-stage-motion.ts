export interface BpmEstimate {
  bpm: number | null;
  confident: boolean;
}

interface StageMotionInput {
  bpm: number | null;
  bpmConfident: boolean;
  energy: number;
}

interface StageMotion {
  cycleSpeed: number;
  density: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, minimum), maximum) : minimum;

export function estimateBpm(beatTimesMs: readonly number[]): BpmEstimate {
  const intervals = beatTimesMs
    .slice(1)
    .map((time, index) => time - beatTimesMs[index])
    .filter((interval) => interval >= 250 && interval <= 1000)
    .slice(-8);

  if (intervals.length < 4) {
    return { bpm: null, confident: false };
  }

  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sortedIntervals.length / 2);
  const median =
    sortedIntervals.length % 2 === 0
      ? (sortedIntervals[middle - 1] + sortedIntervals[middle]) / 2
      : sortedIntervals[middle];
  const stableIntervals = intervals.filter(
    (interval) => Math.abs(interval - median) <= median * 0.12,
  );

  if (stableIntervals.length < 4) {
    return { bpm: null, confident: false };
  }

  const average =
    stableIntervals.reduce((sum, interval) => sum + interval, 0) /
    stableIntervals.length;

  return { bpm: Math.round(60000 / average), confident: true };
}

export function getStageMotion({
  bpm,
  bpmConfident,
  energy,
}: StageMotionInput): StageMotion {
  const speed = bpmConfident && bpm ? clamp(bpm / 120, 0.75, 1.2) : 1;

  return {
    cycleSpeed: Number(speed.toFixed(2)),
    density: clamp(energy, 0.3, 1),
  };
}
