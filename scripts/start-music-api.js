// NeteaseCloudMusicApi 本地服务启动脚本
// 为 Claudio 提供音乐数据 API（搜索、播放 URL、歌词、歌单详情等）
// 登录系统仍使用官方 OpenAPI，不依赖此服务
const { serveNcmApi } = require("NeteaseCloudMusicApi");

const PORT = process.env.MUSIC_API_PORT || 3001;

serveNcmApi({ port: PORT })
  .then(() => {
    console.log(`[NCM API] 音乐数据服务已启动 @ http://localhost:${PORT}`);
    console.log("[NCM API] 可用端点: /search, /song/url, /song/detail, /playlist/detail, /lyric, /personalized, /recommend/songs 等");
  })
  .catch((err) => {
    console.error("[NCM API] 启动失败:", err.message);
    process.exit(1);
  });
