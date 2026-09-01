import assert from "node:assert/strict";
import test from "node:test";

import { estimateBpm, getStageMotion } from "./ktv-stage-motion";

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
