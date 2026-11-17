import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverImage } from "../components/CoverImage";
import { coverImageUrl } from "./cover-image";
import { loadingError, loadingSnapshot, recordLoading } from "./loading-diagnostics";

test("thumbnails preserve CDN path/query and do not change other hosts", () => {
  const result = new URL(coverImageUrl("http://p3.music.126.net/a.jpg?x=1&param=3000y3000", 96));
  assert.equal(result.protocol, "https:");
  assert.equal(result.searchParams.get("param"), "96y96");
  assert.equal(result.searchParams.get("x"), "1");
  assert.equal(coverImageUrl("https://example.com/a.jpg", 96), "https://example.com/a.jpg");
  assert.equal(coverImageUrl("/local-cover.jpg", 96), "/local-cover.jpg");
  assert.equal(coverImageUrl("https://p3.music.126.net.evil.test/a", 96), "https://p3.music.126.net.evil.test/a");
});
test("visible covers are eager; other covers are lazy with fixed dimensions", () => {
  const src = "https://p3.music.126.net/a.jpg";
  const eager = renderToStaticMarkup(<CoverImage size={48} priority src={src} alt="cover" />);
  assert.match(eager, /loading="eager"/);
  assert.match(eager, /fetchPriority="high"/);
  assert.match(eager, /param=96y96/);
  assert.match(eager, /width="48" height="48"/);
  assert.match(renderToStaticMarkup(<CoverImage size={40} src={src} />), /loading="lazy"/);
});
test("diagnostics retain only the latest 200 records and snapshots are detached", () => {
  Object.assign(globalThis, { window: {} });
  const info = console.info;
  console.info = () => {};
  try {
    for (let i = 0; i < 205; i++) recordLoading({ requestId: String(i), stage: "test", elapsedMs: i, result: "success" });
    const snapshot = loadingSnapshot();
    assert.equal(snapshot.length, 200);
    assert.equal(snapshot[0].requestId, "5");
    snapshot[0].requestId = "changed";
    assert.equal(loadingSnapshot()[0].requestId, "5");
    assert.equal(loadingError(new DOMException("secret", "NotAllowedError")), "autoplay");
    assert.equal(loadingError(new DOMException("secret", "TimeoutError")), "timeout");
    assert.equal(JSON.stringify(loadingSnapshot()).includes("secret"), false);
  } finally { console.info = info; Reflect.deleteProperty(globalThis, "window"); }
});
