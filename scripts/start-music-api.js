const { serveNcmApi } = require("NeteaseCloudMusicApi");
const fs = require("fs");
const path = require("path");

const PORT = process.env.MUSIC_API_PORT || 3001;
const COOKIE_FILE = path.join(__dirname, "..", ".netease-cookie");

async function loadSavedCookie() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const cookie = fs.readFileSync(COOKIE_FILE, "utf-8").trim();
      if (cookie) {
        // Refresh login with saved cookie
        await fetch(
          `http://localhost:${PORT}/login/refresh?cookie=${encodeURIComponent(cookie)}`
        );
        console.log("Loaded saved login cookie");
      }
    }
  } catch (err) {
    console.warn("Failed to load saved cookie:", err.message);
  }
}

serveNcmApi({ port: PORT })
  .then(async () => {
    console.log(`Music API server running @ http://localhost:${PORT}`);
    await loadSavedCookie();
  })
  .catch((err) => {
    console.error("Failed to start Music API server:", err);
    process.exit(1);
  });
