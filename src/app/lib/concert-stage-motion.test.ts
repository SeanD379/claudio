import assert from "node:assert/strict";
import test from "node:test";

import { estimateBpm, getStageMotion } from "./concert-stage-motion";

test("estimates a confident 120 BPM from steady half-second beats", () => {
  assert.deepEqual(estimateBpm([0, 500, 1000, 1500, 2000, 2500]), {
    bpm: 120,
    confident: true,
  });
});

test("rejects insufficient valid beat intervals", () => {
  assert.deepEqual(estimateBpm([0, 0, 30, 5000]), {
    bpm: null,
    confident: false,
  });
});

test("rejects intervals outside the median stability range", () => {
  assert.deepEqual(estimateBpm([0, 300, 600, 900, 1500, 2100, 2700]), {
    bpm: null,
    confident: false,
  });
});

test("derives bounded stage motion from confident BPM and energy", () => {
  assert.deepEqual(getStageMotion({ bpm: 128, bpmConfident: true, energy: 2 }), {
    cycleSpeed: 1.07,
    density: 1,
  });
});

test("uses fallback speed and clamps low energy without confident BPM", () => {
  assert.deepEqual(getStageMotion({ bpm: 128, bpmConfident: false, energy: -1 }), {
    cycleSpeed: 1,
    density: 0.3,
  });
});

test("uses finite fallback density for NaN energy", () => {
  const motion = getStageMotion({
    bpm: null,
    bpmConfident: false,
    energy: Number.NaN,
  });

  assert.equal(motion.cycleSpeed, 1);
  assert.equal(motion.density, 0.3);
  assert.equal(Number.isFinite(motion.density), true);
});

test("clamps confident low BPM speed", () => {
  assert.deepEqual(getStageMotion({ bpm: 60, bpmConfident: true, energy: 0.5 }), {
    cycleSpeed: 0.75,
    density: 0.5,
  });
});

test("clamps confident high BPM speed", () => {
  assert.deepEqual(getStageMotion({ bpm: 240, bpmConfident: true, energy: 0.5 }), {
    cycleSpeed: 1.2,
    density: 0.5,
  });
});
