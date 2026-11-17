import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSongPlayback } from "./ncm-api";

test("playback resolver carries the browser session and categorizes real NCM shapes", async () => {
  const originalFetch = globalThis.fetch;
  let queried = "";
  let response: object = { code: 200, data: [{ url: "https://audio.test/1", code: 200 }] };
  let status = 200;
  globalThis.fetch = async (input) => { queried = String(input); return new Response(JSON.stringify(response), { status }); };
  const options = { cookie: "MUSIC_U=browser-test", onStage: () => {} };
  try {
    assert.equal((await resolveSongPlayback("123", options)).audioUrl, "https://audio.test/1");
    assert.equal(new URL(queried).searchParams.get("cookie"), options.cookie);
    response = { code: 200, data: [{ url: null, code: 404 }] };
    assert.equal((await resolveSongPlayback("123", options)).errorCategory, "unavailable");
    response = { code: 301 };
    assert.equal((await resolveSongPlayback("123", options)).errorCategory, "auth");
    status = 401;
    assert.equal((await resolveSongPlayback("123", options)).errorCategory, "auth");
    status = 502;
    assert.equal((await resolveSongPlayback("123", options)).errorCategory, "upstream");
    globalThis.fetch = async () => { throw new TypeError("network secret"); };
    assert.equal((await resolveSongPlayback("123", options)).errorCategory, "network");
    const controller = new AbortController(); controller.abort(new DOMException("deadline", "TimeoutError"));
    assert.equal((await resolveSongPlayback("123", { ...options, signal: controller.signal })).errorCategory, "timeout");
  } finally { globalThis.fetch = originalFetch; }
});
