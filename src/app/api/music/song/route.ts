import { NextRequest, NextResponse } from "next/server";
import { resolveSongPlayback } from "@/app/lib/ncm-api";
import { createLoadingId, recordLoading, type LoadingError } from "@/app/lib/loading-diagnostics";

export async function GET(request: NextRequest) {
  const suppliedId = request.headers.get("x-request-id") || "";
  const requestId = /^[a-zA-Z0-9-]{1,80}$/.test(suppliedId) ? suppliedId : createLoadingId();
  const start = performance.now();
  const songId = request.nextUrl.searchParams.get("id");
  let upstreamCode: number | undefined;
  const reply = (body: object, status: number, errorCategory?: LoadingError) => {
    const elapsedMs = performance.now() - start;
    recordLoading({ requestId, songId: songId && /^\d{1,20}$/.test(songId) ? songId : undefined,
      stage: "song-url-response", elapsedMs, result: errorCategory === "cancelled" ? "cancelled" : errorCategory ? "failure" : "success", status, errorCategory });
    return NextResponse.json(body, { status, headers: {
      "X-Request-ID": requestId, "Server-Timing": `song_url;dur=${elapsedMs.toFixed(1)}${upstreamCode === undefined ? "" : `, music_upstream;desc="${upstreamCode}"`}`,
      "Cache-Control": "private, no-store",
    } });
  };
  if (!songId || !/^\d{1,20}$/.test(songId)) return reply({ error: "Valid song ID is required" }, 400, "unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Playback URL timeout", "TimeoutError")), 12000);
  const signal = AbortSignal.any([request.signal, controller.signal]);
  let stopWaiting: (() => void) | undefined;
  try {
    // SDK calls cannot be cancelled internally; bound how long this route waits.
    const cancelled = new Promise<{ audioUrl: null; errorCategory: LoadingError }>((resolve) => {
      const onAbort = () => resolve({ audioUrl: null, errorCategory: request.signal.aborted ? "cancelled" : "timeout" });
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
      stopWaiting = () => signal.removeEventListener("abort", onAbort);
    });
    const result = await Promise.race([resolveSongPlayback(songId, {
      cookie: request.cookies.get("nc_netease_session")?.value,
      signal,
      onStage: (stage, errorCategory) => {
        if (signal.aborted) return;
        const code = stage.match(/^upstream-song-(-?\d+)$/)?.[1];
        if (code) upstreamCode = Number(code);
        recordLoading({ requestId, songId, stage,
          elapsedMs: performance.now() - start, result: errorCategory ? "failure" : "success", errorCategory });
      },
    }), cancelled]);
    const category = result.errorCategory;
    const status = !category || category === "unavailable" ? 200 : category === "auth" ? 401 : category === "timeout" ? 504 : category === "cancelled" ? 499 : 502;
    return reply(result, status, category);
  } finally {
    clearTimeout(timeout);
    stopWaiting?.();
  }
}
