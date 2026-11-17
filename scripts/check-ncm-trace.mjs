import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// 本地 node_modules 完整并不代表部署产物完整；在每次构建后检查函数依赖。
for (const route of ["netease/login/qrcode", "user/playlists/netease-mine", "user/playlists", "user/playlists/sync", "music/playlist"]) {
  const trace = JSON.parse(readFileSync(`.next/server/app/api/${route}/route.js.nft.json`, "utf8"));
  const required = [
    "NeteaseCloudMusicApi/util/request.js",
    "NeteaseCloudMusicApi/util/config.json",
  ];
  if (route.endsWith("qrcode") || route.endsWith("netease-mine")) {
    required.push(
      "NeteaseCloudMusicApi/module/login_qr_check.js",
      "NeteaseCloudMusicApi/module/login_qr_create.js",
      "NeteaseCloudMusicApi/module/login_qr_key.js",
      "NeteaseCloudMusicApi/module/user_account.js",
      "qrcode/lib/server.js",
    );
    if (route.endsWith("netease-mine")) required.push("NeteaseCloudMusicApi/module/user_playlist.js");
  } else {
    required.push("NeteaseCloudMusicApi/module/playlist_detail.js");
  }
  for (const file of required) {
    assert.ok(trace.files.some((entry) => entry.replaceAll("\\", "/").endsWith(`/node_modules/${file}`)),
      `/api/${route} 部署依赖缺失: ${file}`);
  }
}
console.log("NCM login and playlist deployment traces verified.");
const playbackTrace = JSON.parse(readFileSync(".next/server/app/api/music/song/route.js.nft.json", "utf8"));
for (const file of ["NeteaseCloudMusicApi/module/song_url.js", "NeteaseCloudMusicApi/module/song_url_v1.js", "NeteaseCloudMusicApi/util/request.js"]) {
  assert.ok(playbackTrace.files.some((entry) => entry.replaceAll("\\", "/").endsWith(`/node_modules/${file}`)),
    `/api/music/song 部署依赖缺失: ${file}`);
}
console.log("NCM playback deployment trace verified.");
