// HTTP-only comparison; this does not measure browser rendering or audible playback.
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const label = process.argv[2] || "after";
if (!/^[a-z-]+$/.test(label)) throw new Error("Use a simple measurement label");
const base = "http://127.0.0.1:3000";
const runId = crypto.randomUUID();
const songId = "29357087";
const samples = [];
async function measure(stage, url, attempt) {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "X-Request-ID": `${runId}-${stage}-${attempt}` },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const json = response.headers.get("content-type")?.includes("json")
      ? JSON.parse(new TextDecoder().decode(bytes)) : null;
    samples.push({ stage, attempt, status: response.status, ms: Math.round(performance.now() - start),
      bytes: bytes.length, requestId: response.headers.get("x-request-id"),
      serverTiming: response.headers.get("server-timing"),
      playable: stage === "song-url" ? Boolean(json?.audioUrl) : undefined,
      errorCategory: json?.errorCategory });
    return { json, bytes };
  } catch (error) {
    samples.push({ stage, attempt, ms: Math.round(performance.now() - start), errorCategory: error.name });
  }
}
for (let attempt = 1; attempt <= 2; attempt++) await measure("song-url", `${base}/api/music/song?id=${songId}`, attempt);
const detail = await measure("song-detail", `${base}/api/music/songs?ids=${songId}`, 1);
const cover = detail?.json?.songs?.[0]?.coverUrl;
if (cover && /^https?:\/\/p\d+\.music\.126\.net\//.test(cover)) {
  for (const size of [0, 96]) {
    const url = new URL(cover);
    if (size) {
      url.protocol = "https:";
      url.searchParams.set("param", `${size}y${size}`);
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await measure(size ? "cover-96" : "cover-original", url, attempt);
      if (attempt === 1 && result && label === "before") {
        await mkdir("D:/CodexData/outputs/claudio", { recursive: true });
        await writeFile(`D:/CodexData/outputs/claudio/${size ? "cover-96" : "cover-original"}.jpg`, result.bytes);
      }
    }
  }
}
const report = { date: new Date().toISOString(), label, runId, environment: "local production HTTP; uncontrolled network; Node fetch without browser cache", songId,
  caveat: "Attempt 1/2 are first/repeat requests in this run, not proven cold/warm server or browser cache. No audio downloaded or played.", samples };
await mkdir("D:/CodexData/outputs/claudio", { recursive: true });
await writeFile(`D:/CodexData/outputs/claudio/loading-${label}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
