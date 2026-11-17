import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";

class FakeAudio extends EventTarget {
  src = ""; paused = true; readyState = 0; preload = ""; volume = 1;
  currentTime = 0; duration = 120; error: { code: number } | null = null;
  rejectPlay = false;
  play = async () => {
    if (this.rejectPlay) throw new DOMException("blocked", "NotAllowedError");
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  };
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  load() { this.readyState = 0; }
  removeAttribute() { this.src = ""; }
  playing() { this.paused = false; this.readyState = 4; this.dispatchEvent(new Event("playing")); }
}
const audio = new FakeAudio();
Object.assign(globalThis, {
  Audio: function () { return audio; },
  window: { addEventListener: (_: string, handler: () => void) => handler() },
  localStorage: { getItem: () => null, setItem: () => {} },
  requestAnimationFrame: (fn: () => void) => { fn(); return 1; },
});
let usePlayer: typeof import("./usePlayer").usePlayer;
before(async () => { ({ usePlayer } = await import("./usePlayer")); });
const song = (id: string, audioUrl?: string) => ({ id, neteaseId: id, title: id, artist: "test", album: "test", coverUrl: "", duration: 120, audioUrl });
beforeEach(() => {
  audio.rejectPlay = false;
  audio.error = null;
  usePlayer.setState({ beforePlay: null, playlist: [], playHistory: [] });
  globalThis.fetch = async () => new Response(JSON.stringify({ audioUrl: "https://audio.test/song" }));
});

test("rejected play never claims to be playing", async () => {
  audio.rejectPlay = true;
  await usePlayer.getState().playSong(song("1", "https://audio.test/1"));
  assert.equal(usePlayer.getState().isPlaying, false);
  assert.equal(usePlayer.getState().isLoading, false);
});
test("play waits for playing event and buffering resumes truthfully", async () => {
  await usePlayer.getState().playSong(song("2", "https://audio.test/2"));
  assert.equal(usePlayer.getState().isPlaying, false);
  assert.equal(usePlayer.getState().isLoading, true);
  audio.playing();
  assert.equal(usePlayer.getState().isPlaying, true);
  audio.dispatchEvent(new Event("waiting"));
  assert.equal(usePlayer.getState().isLoading, true);
  audio.playing();
  assert.equal(usePlayer.getState().isLoading, false);
  audio.pause();
  assert.equal(usePlayer.getState().isPlaying, false);
});
test("late URL result cannot override a newer song; old fetch is aborted", async () => {
  let resolveOld!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  globalThis.fetch = async (_input, options) => {
    signal = options?.signal as AbortSignal;
    return new Promise<Response>((resolve) => { resolveOld = resolve; });
  };
  const old = usePlayer.getState().playSong(song("3"));
  await usePlayer.getState().playSong(song("4", "https://audio.test/4"));
  assert.equal(signal?.aborted, true);
  resolveOld(new Response(JSON.stringify({ audioUrl: "https://audio.test/3", coverUrl: "old" })));
  await old;
  assert.equal(audio.src, "https://audio.test/4");
  assert.equal(usePlayer.getState().currentSong?.neteaseId, "4");
});
test("late beforePlay does not start a superseded song", async () => {
  let release!: () => void;
  usePlayer.setState({ beforePlay: () => new Promise<void>((resolve) => { release = resolve; }) });
  const old = usePlayer.getState().playSong(song("5", "https://audio.test/5"));
  usePlayer.setState({ beforePlay: null });
  await usePlayer.getState().playSong(song("6", "https://audio.test/6"));
  release(); await old;
  assert.equal(audio.src, "https://audio.test/6");
});
test("URL failure and media error leave playback stopped", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ audioUrl: null, errorCategory: "unavailable" }));
  await usePlayer.getState().playSong(song("7"));
  assert.equal(usePlayer.getState().isPlaying, false);
  assert.equal(usePlayer.getState().isLoading, false);
  await usePlayer.getState().playSong(song("8", "https://audio.test/8"));
  audio.error = { code: 2 };
  audio.dispatchEvent(new Event("error"));
  assert.equal(usePlayer.getState().isLoading, false);
  assert.equal(usePlayer.getState().isPlaying, false);
});
test("loading gets a slow hint and a bounded timeout", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await usePlayer.getState().playSong(song("9", "https://audio.test/9"));
    context.mock.timers.tick(3000);
    assert.equal(usePlayer.getState().loadingSlow, true);
    context.mock.timers.tick(12000);
    assert.equal(usePlayer.getState().playbackError, "timeout");
    assert.equal(usePlayer.getState().isLoading, false);
  } finally { context.mock.timers.reset(); }
});
test("a rejected resume from an old song cannot change the new song state", async () => {
  await usePlayer.getState().playSong(song("10", "https://audio.test/10"));
  audio.playing(); audio.pause();
  const originalPlay = audio.play;
  let rejectOld!: (reason: Error) => void;
  audio.play = () => new Promise<void>((_resolve, reject) => { rejectOld = reject; });
  usePlayer.getState().togglePlay();
  audio.play = originalPlay;
  await usePlayer.getState().playSong(song("11", "https://audio.test/11"));
  audio.playing();
  rejectOld(new DOMException("old failure", "NotAllowedError"));
  await Promise.resolve();
  assert.equal(usePlayer.getState().isPlaying, true);
  assert.equal(usePlayer.getState().playbackError, null);
  audio.pause();
});
