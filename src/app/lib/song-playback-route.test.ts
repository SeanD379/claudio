import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import type { LoadingError } from "./loading-diagnostics";

const require = createRequire(resolve(process.cwd(), "package.json"));
const id = require.resolve("./src/app/lib/ncm-api.ts");
let result: { audioUrl: string | null; errorCategory?: LoadingError };
let receivedCookie: string | undefined;
let hang = false;
let calls = 0;
require.cache[id] = { id, filename: id, loaded: true, exports: {
  resolveSongPlayback: async (_songId: string, options: { cookie?: string; onStage: (stage: string) => void }) => {
    calls++; receivedCookie = options.cookie; options.onStage("credentials-ready");
    if (hang) return new Promise(() => {});
    return result;
  },
} } as NodeModule;
let GET: typeof import("../api/music/song/route").GET;
before(async () => { ({ GET } = await import("../api/music/song/route")); });
beforeEach(() => { result = { audioUrl: "https://audio.test/private?token=never-log" }; hang = false; calls = 0; });
function request(requestId = "test-request-123", signal?: AbortSignal) {
  return new NextRequest("https://localhost/api/music/song?id=123", {
    headers: { "X-Request-ID": requestId, Cookie: "nc_netease_session=MUSIC_U%3Dnever-log" }, signal,
  });
}
test("preserves audioUrl and correlates response/logs without exposing credentials or URL", async () => {
  const lines: string[] = []; const info = console.info;
  console.info = (...args) => { lines.push(args.join(" ")); };
  try {
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).audioUrl, result.audioUrl);
    assert.equal(response.headers.get("x-request-id"), "test-request-123");
    assert.match(response.headers.get("server-timing")!, /^song_url;dur=/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(receivedCookie, "MUSIC_U=never-log");
    assert.equal(lines.join().includes("never-log"), false);
    assert.equal(lines.every((line) => line.includes("test-request-123")), true);
  } finally { console.info = info; }
});
test("classifies unavailable, auth, network and timeout separately", async () => {
  for (const [category, status] of [["unavailable", 200], ["auth", 401], ["network", 502], ["timeout", 504]] as const) {
    result = { audioUrl: null, errorCategory: category };
    const response = await GET(request());
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), result);
  }
});
test("invalid IDs do not call upstream; untrusted request IDs are replaced", async () => {
  const response = await GET(new NextRequest("https://localhost/api/music/song?id=secret"));
  assert.equal(response.status, 400); assert.equal(calls, 0);
  const replaced = await GET(request("https://secret.test/private"));
  assert.match(replaced.headers.get("x-request-id")!, /^[a-f0-9-]{36}$/);
});
test("client abort releases a hanging SDK request without calling it a failure", async () => {
  hang = true;
  const controller = new AbortController();
  const pending = GET(request("cancelled-request", controller.signal));
  controller.abort();
  const response = await pending;
  assert.equal(response.status, 499);
  assert.equal((await response.json()).errorCategory, "cancelled");
});
test("route deadline bounds a hanging SDK call", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    hang = true;
    const pending = GET(request());
    context.mock.timers.tick(12000);
    const response = await pending;
    assert.equal(response.status, 504);
    assert.equal((await response.json()).errorCategory, "timeout");
  } finally { context.mock.timers.reset(); }
});
