import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { NextRequest } from "next/server";

const require = createRequire(resolve(process.cwd(), "package.json"));
process.env.NETLIFY = "true";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/test";
let responseCode = 200;
let thrownError: unknown;
let hasPlaylist = true;
let receivedCookie: unknown;
let playlistWrites = 0;
const remotePlaylist = {
  id: 123, name: "测试歌单", trackCount: 1,
  tracks: [{ id: 456, name: "测试歌曲", ar: [{ name: "歌手" }], al: { name: "专辑" }, dt: 120000 }],
};
function replaceModule(name: string, exports: unknown) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
replaceModule("NeteaseCloudMusicApi/util/request", async (
  _uri: string, _data: unknown, options: { cookie?: unknown }
) => {
  receivedCookie = options.cookie;
  if (thrownError) throw thrownError;
  return { body: { code: responseCode, playlist: hasPlaylist ? remotePlaylist : undefined } };
});
replaceModule("@prisma/client", {
  PrismaClient: class {
    user = { upsert: async () => ({ id: "default-user" }) };
    playlist = {
      findFirst: async ({ where }: { where: { id?: string } }) => where.id === "local-playlist"
        ? { id: "local-playlist", name: "测试歌单", neteaseId: "123" }
        : null,
      create: async ({ data }: { data: { name: string } }) => {
        playlistWrites++;
        return { id: "local-playlist", name: data.name };
      },
    };
    song = {
      createMany: async () => ({}),
      findMany: async () => [{ id: "local-song" }],
    };
    playlistSong = {
      createMany: async () => ({}),
      findMany: async () => [{ song: { id: "local-song", neteaseId: "456", title: "测试歌曲", artist: "歌手" } }],
    };
  },
});

function importRequest() {
  return new NextRequest("https://localhost/api/user/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "nc_netease_session=MUSIC_U%3Dbrowser-session" },
    body: JSON.stringify({ source: "netease", neteasePlaylistId: "123" }),
  });
}

test("全新函数临时目录能加载真实 NCM 请求模块并取得歌单", () => {
  mkdirSync(resolve(".next"), { recursive: true });
  const tempDir = mkdtempSync(resolve(".next/ncm-cold-"));
  const code = `
    const {createRequire}=require('node:module');
    const {resolve}=require('node:path');
    const {existsSync}=require('node:fs');
    const req=createRequire(resolve('package.json'));
    const axiosId=req.resolve('axios');
    req.cache[axiosId]={id:axiosId,filename:axiosId,loaded:true,exports:{default:async()=>({
      status:200,headers:{},data:{code:200,playlist:${JSON.stringify(remotePlaylist)}}
    })}};
    const {getPlaylistDetail}=require('./src/app/lib/ncm-api.ts');
    (async()=>{
      const before=existsSync(resolve(require('node:os').tmpdir(),'anonymous_token'));
      const result=await getPlaylistDetail('123','MUSIC_U=synthetic');
      console.log(JSON.stringify({before,result}));
    })().catch(()=>process.exitCode=1);
  `;
  const child = spawnSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), "-e", code], {
    cwd: process.cwd(), encoding: "utf8", timeout: 15000,
    env: { ...process.env, TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir, NETLIFY: "true" },
  });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout.trim());
  assert.equal(result.before, false);
  assert.equal(result.result?.playlist.id, "123");
  assert.equal(result.result?.songs[0].neteaseId, "456");
});

test("上游网络及模块加载错误不再误报歌单不存在", async () => {
  const { POST } = await import("../api/user/playlists/route");
  for (const error of [{ body: { code: 502 } }, Object.assign(new Error("missing runtime file"), { code: "ENOENT" })]) {
    thrownError = error;
    const before = playlistWrites;
    const response = await POST(importRequest());
    assert.equal(response.status, 502);
    assert.doesNotMatch((await response.json()).error, /not found/i);
    assert.equal(playlistWrites, before);
  }
  thrownError = undefined;
});

test("歌单不存在、登录失效、权限不足和响应缺失分别处理", async () => {
  const { POST } = await import("../api/user/playlists/route");
  for (const rejects of [false, true]) {
    for (const [code, status] of [[404, 404], [301, 401], [401, 401], [403, 403], [503, 502]]) {
      responseCode = code;
      thrownError = rejects ? { body: { code } } : undefined;
      hasPlaylist = false;
      assert.equal((await POST(importRequest())).status, status, `NCM code ${code}, rejects=${rejects}`);
    }
  }
  thrownError = undefined;
  responseCode = 200;
  assert.equal((await POST(importRequest())).status, 502, "成功状态但缺失歌单不能当作 404");
  hasPlaylist = true;
});

test("导入时使用浏览器凭证，成功获取详情后才写入歌单", async () => {
  const { POST } = await import("../api/user/playlists/route");
  const before = playlistWrites;
  const response = await POST(importRequest());
  assert.equal(response.status, 200);
  assert.equal(receivedCookie, "MUSIC_U=browser-session");
  assert.equal(playlistWrites, before + 1);
  assert.equal((await response.json()).playlist.trackCount, 1);
});

test("本地与 Netlify 的歌单详情使用相同模块并传递当前凭证", async () => {
  const { getPlaylistDetail } = await import("./ncm-api");
  delete process.env.NETLIFY;
  try {
    const detail = await getPlaylistDetail("123", "MUSIC_U=local-browser");
    assert.equal(detail?.songs[0].neteaseId, "456");
    assert.equal(receivedCookie, "MUSIC_U=local-browser");
  } finally {
    process.env.NETLIFY = "true";
  }
});

test("新实例可仅凭浏览器登录态打开已导入歌单", async () => {
  const { GET } = await import("../api/user/playlists/[id]/songs/route");
  const response = await GET(new NextRequest("https://localhost/api/user/playlists/local-playlist/songs", {
    headers: { cookie: "nc_netease_session=MUSIC_U%3Dbrowser-session" },
  }), { params: Promise.resolve({ id: "local-playlist" }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.songs[0].neteaseId, "456");
});
