import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve(process.cwd(), "package.json"));
let sdkCalls = 0;
let httpCalls = 0;
let legacyHasUrl = true;
let v1Fails = false;
let v1ErrorResponse = false;
function replace(name: string, exports: unknown) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
replace("NeteaseCloudMusicApi", { song_url: async () => {
  throw Object.assign(new Error("Unrelated SDK module missing"), { code: "MODULE_NOT_FOUND" });
} });
replace("NeteaseCloudMusicApi/util/request", async (uri: string) => {
  sdkCalls++;
  if (v1Fails && uri.endsWith("/v1")) throw { body: { code: 502 } };
  if (v1ErrorResponse && uri.endsWith("/v1")) return { body: { code: 502 } };
  return { body: { code: 200, data: [{ id: 123, code: 200, url: legacyHasUrl || uri.endsWith("/v1") ? "https://audio.test/123" : null }] } };
});
let resolveSongPlayback: typeof import("./ncm-api").resolveSongPlayback;
before(async () => { ({ resolveSongPlayback } = await import("./ncm-api")); });
beforeEach(() => {
  sdkCalls = 0; httpCalls = 0;
  legacyHasUrl = true;
  v1Fails = false;
  v1ErrorResponse = false;
  delete process.env.NETLIFY;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  globalThis.fetch = async () => { httpCalls++; throw new TypeError("localhost is unavailable in Lambda"); };
});
test("Lambda uses the SDK even when the build-only NETLIFY flag is absent", async () => {
  process.env.AWS_LAMBDA_FUNCTION_NAME = "netlify-test-function";
  const result = await resolveSongPlayback("123", { cookie: "MUSIC_U=test", onStage: () => {} });
  assert.equal(result.audioUrl, "https://audio.test/123");
  assert.equal(sdkCalls, 1);
  assert.equal(httpCalls, 0);
});
test("playback loads its own SDK module without requiring the bulk package", async () => {
  process.env.NETLIFY = "true";
  const result = await resolveSongPlayback("123", { cookie: "MUSIC_U=test", onStage: () => {} });
  assert.equal(result.audioUrl, "https://audio.test/123");
  assert.equal(sdkCalls, 1);
});
test("a missing legacy URL gets one v1 attempt at the same quality level", async () => {
  process.env.NETLIFY = "true";
  legacyHasUrl = false;
  const stages: string[] = [];
  const result = await resolveSongPlayback("123", { cookie: "MUSIC_U=test", onStage: (stage) => { stages.push(stage); } });
  assert.equal(result.audioUrl, "https://audio.test/123");
  assert.equal(sdkCalls, 2);
  assert.equal(stages.filter(stage => stage === "url-v1-request").length, 1);
});
test("a failed v1 attempt preserves the original unavailable result", async () => {
  process.env.NETLIFY = "true";
  legacyHasUrl = false; v1Fails = true;
  const result = await resolveSongPlayback("123", { cookie: "MUSIC_U=test", onStage: () => {} });
  assert.deepEqual(result, { audioUrl: null, errorCategory: "unavailable" });
  assert.equal(sdkCalls, 2);
});
test("a v1 error body also preserves the original unavailable result", async () => {
  process.env.NETLIFY = "true";
  legacyHasUrl = false; v1ErrorResponse = true;
  const result = await resolveSongPlayback("123", { cookie: "MUSIC_U=test", onStage: () => {} });
  assert.deepEqual(result, { audioUrl: null, errorCategory: "unavailable" });
});
