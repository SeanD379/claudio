import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { resolve } from "node:path";
import { compactNcmCookie } from "./ncm-session";
import * as auth from "./ncm-auth";
import { NextRequest } from "next/server";

const require = createRequire(resolve(process.cwd(), "package.json"));
let accountCode = 200;
const seenCookies: string[] = [];
let dbReads = 0;
let playlistCode = 200;
let playlistThrows = false;
let qrKeyFailures = 0;
let qrKeyRequests = 0;
let qrCheckFails = false;
let qrCookieMissing = false;
let qrResponseCode: number | undefined = 803;
let playlistRows: Array<{ id: number; name: string; trackCount: number; coverImgUrl: string; creator?: { nickname: string } }> = [];

// 模拟两个函数实例不共享的持久存储，以及网易云接口短暂故障。
process.env.NETLIFY = "true";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/test";
function replaceModule(name: string, exports: unknown) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
replaceModule("@prisma/client", {
  PrismaClient: class {
    tokenStore = {
      findUnique: async () => {
        dbReads++;
        return { accessToken: "MUSIC_U=old-server-session" };
      },
      upsert: async () => { throw new Error("database unavailable"); },
      delete: async () => { throw new Error("database unavailable"); },
    };
    playlist = { findMany: async () => { throw new Error("database unavailable"); } };
    async $disconnect() {}
  },
});
replaceModule("NeteaseCloudMusicApi/util/request", async (
  uri: string, _data: unknown, options: { cookie?: string }
) => {
  if (uri === "/api/login/qrcode/unikey") {
    qrKeyRequests++;
    if (qrKeyFailures-- > 0) throw { body: { code: 502, msg: "Client network socket disconnected before secure TLS connection was established" } };
    return { body: { code: 200, unikey: "test-qr-key" }, cookie: [] };
  }
  if (uri.includes("qrcode/client/login")) {
    if (qrCheckFails) throw { body: { code: 502, msg: "TLS connection failed" } };
    return { body: { code: qrResponseCode }, cookie: qrCookieMissing ? [] : ["MUSIC_U=new-browser-session; Path=/; HttpOnly", "__csrf=csrf; Path=/"] };
  }
  seenCookies.push(options.cookie || "");
  if (uri === "/api/user/playlist") {
    if (playlistThrows) throw { body: { code: playlistCode } };
    return { body: { code: playlistCode, playlist: playlistCode === 200 ? playlistRows : undefined } };
  }
  if (accountCode !== 200) throw { body: { code: accountCode } };
  return { body: { code: 200, profile: { userId: 123, nickname: "test", avatarUrl: "" } } };
});

test("去重 Set-Cookie 属性使超过 4KB 的 QR 响应可由浏览器携带", () => {
  const raw = Array.from({ length: 35 }, () =>
    "MUSIC_U=token==; Max-Age=123456; Expires=Fri, 01 Jan 2038 00:00:00 GMT; Path=/api/login; HttpOnly; Secure"
  ).join(";") + ";__csrf=csrf; Path=/";
  assert.ok(Buffer.byteLength(encodeURIComponent(raw)) > 4096);
  assert.equal(compactNcmCookie(raw), "MUSIC_U=token==; __csrf=csrf");
  assert.throws(() => compactNcmCookie(`MUSIC_U=${"x".repeat(4000)}`), /凭证过长/);
});

test("冷启动及热实例都优先使用当前浏览器凭证", async () => {
  assert.equal(await auth.getValidCookie("MUSIC_U=browser"), "MUSIC_U=browser");
  assert.equal(dbReads, 0);
  assert.equal(await auth.getValidCookie(), "MUSIC_U=old-server-session");
  assert.equal(await auth.getValidCookie("MUSIC_U=browser"), "MUSIC_U=browser");
});

test("网易云临时故障不删除登录态，恢复后同一凭证可重试", async () => {
  accountCode = 503;
  await assert.rejects(auth.getUserProfile("MUSIC_U=browser"), /暂时不可用/);
  accountCode = 200;
  assert.equal((await auth.getUserProfile("MUSIC_U=browser"))?.userId, 123);
  assert.equal(await auth.getValidCookie(), "MUSIC_U=old-server-session");
  assert.equal(seenCookies.at(-1), "MUSIC_U=browser");
});

test("确认凭证失效返回未登录，不清除其他实例的凭证", async () => {
  accountCode = 301;
  const before = seenCookies.length;
  assert.equal(await auth.getUserProfile("MUSIC_U=expired"), null);
  assert.equal(seenCookies.length, before + 1, "明确鉴权失败不应反复请求网易云");
  assert.equal(await auth.getValidCookie(), "MUSIC_U=old-server-session");
});

test("扫码成功但资料和数据库不可达时仍返回可携带的凭证", async () => {
  accountCode = 503;
  const result = await auth.checkQrStatus("qr-key");
  assert.equal(result.status, 803);
  assert.equal(result.profile, null);
  assert.equal(result.cookie, "MUSIC_U=new-browser-session; __csrf=csrf");
});

test("QR 响应下发小体积 HttpOnly Cookie，并兼容本地 HTTP", async () => {
  const { GET } = await import("../api/netease/login/qrcode/route");
  for (const protocol of ["http", "https"]) {
    const response = await GET(new NextRequest(`${protocol}://localhost/api/netease/login/qrcode?action=check&key=test`));
    assert.equal((await response.json()).code, 803);
    const header = response.headers.get("set-cookie")!;
    assert.ok(Buffer.byteLength(header) < 4096);
    assert.match(header, /HttpOnly/i);
    assert.equal(/; Secure/i.test(header), protocol === "https");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});

test("歌单接口区分上游故障、凭证失效和真正的空歌单", async () => {
  const { GET } = await import("../api/user/playlists/netease-mine/route");
  const request = () => new NextRequest("https://localhost/api/user/playlists/netease-mine", {
    headers: { cookie: `nc_netease_session=${encodeURIComponent("MUSIC_U=current-browser")}` },
  });
  assert.equal((await GET(request())).status, 502);
  accountCode = 301;
  assert.equal((await GET(request())).status, 401);
  accountCode = 200;
  playlistCode = 503;
  assert.equal((await GET(request())).status, 502);
  playlistCode = 200;
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { playlists: [] });
  assert.equal(seenCookies.at(-1), "MUSIC_U=current-browser");
});

test("歌单接口本身确认登录失效时要求重新扫码", async () => {
  const { GET } = await import("../api/user/playlists/netease-mine/route");
  for (const throws of [false, true]) {
    playlistThrows = throws;
    for (const code of [301, 401]) {
      playlistCode = code;
      const response = await GET(new NextRequest("https://localhost/api/user/playlists/netease-mine", {
        headers: { cookie: "nc_netease_session=MUSIC_U%3Dexpired" },
      }));
      assert.equal(response.status, 401);
      assert.match((await response.json()).error, /未登录/);
    }
  }
  playlistThrows = false;
  playlistCode = 200;
});

test("数据库不可达不影响返回非空的远端歌单", async () => {
  playlistThrows = false;
  playlistCode = 200;
  playlistRows = [{ id: 42, name: "测试歌单", trackCount: 3, coverImgUrl: "https://example.com/cover.jpg", creator: { nickname: "test" } }];
  const { GET } = await import("../api/user/playlists/netease-mine/route");
  const response = await GET(new NextRequest("https://localhost/api/user/playlists/netease-mine", {
    headers: { cookie: "nc_netease_session=MUSIC_U%3Dcurrent-browser" },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { playlists: [{ playlistId: 42, name: "测试歌单", trackCount: 3, coverUrl: "https://example.com/cover.jpg", creator: "test", imported: false, isMine: true }] });
  playlistRows = [];
});

test("数据库不可达时断开连接仍清除浏览器和内存兜底", async () => {
  const { POST } = await import("../api/netease/login/disconnect/route");
  const response = await POST();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie")!, /nc_netease_session=;/);
  assert.equal((globalThis as { __ncmCookieCache?: unknown }).__ncmCookieCache, undefined);
});

test("生成二维码的首次临时连接失败可恢复，最多重试一次", async () => {
  qrKeyFailures = 1;
  qrKeyRequests = 0;
  const result = await auth.generateQrCode();
  assert.equal(result?.uniKey, "test-qr-key");
  assert.ok(result?.qrImg.startsWith("data:image/png;base64,"));
  assert.equal(qrKeyRequests, 2);
});

test("连续连接失败时返回短提示，不把内部 TLS 错误发送到界面", async () => {
  qrKeyFailures = 10;
  qrKeyRequests = 0;
  const { GET } = await import("../api/netease/login/qrcode/route");
  const response = await GET(new NextRequest("https://localhost/api/netease/login/qrcode?action=generate"));
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.match(body.error, /暂时无法连接网易云/);
  assert.equal(body.detail, undefined);
  assert.doesNotMatch(JSON.stringify(body), /TLS|socket|NCM request failed/);
  assert.equal(qrKeyRequests, 2);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  qrKeyFailures = 0;
});

test("QR 查询连接失败不会误报过期，也不会触发 SDK 的 result 未定义错误", async () => {
  qrCheckFails = true;
  try {
    const result = await auth.checkQrStatus("key");
    assert.equal(result.status, 502);
    const { GET } = await import("../api/netease/login/qrcode/route");
    const response = await GET(new NextRequest("https://localhost/api/netease/login/qrcode?action=check&key=test"));
    assert.equal(response.status, 502);
  } finally {
    qrCheckFails = false;
  }
});

test("扫码确认但未收到凭证时不能向浏览器报告登录成功", async () => {
  qrCookieMissing = true;
  try {
    assert.equal((await auth.checkQrStatus("key")).status, 502);
  } finally {
    qrCookieMissing = false;
  }
});

test("仅明确的 800 代表二维码过期，异常响应可重试", async () => {
  try {
    for (const code of [undefined, 200, 500]) {
      qrResponseCode = code;
      assert.equal((await auth.checkQrStatus("key")).status, 502);
    }
    qrResponseCode = 800;
    assert.equal((await auth.checkQrStatus("key")).status, 800);
  } finally {
    qrResponseCode = 803;
  }
});
