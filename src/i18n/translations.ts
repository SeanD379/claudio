export type Lang = "zh" | "en";

const translations = {
  // Chat
  "chat.title": { zh: "与 Claudio 对话", en: "Chat with Claudio" },
  "chat.placeholder": { zh: "和 Claudio 聊聊天...", en: "Chat with Claudio..." },
  "chat.welcome": {
    zh: "你好！我是 Claudio，你的私人 DJ。今天想听什么类型的音乐呢？",
    en: "Hello! I'm Claudio, your personal DJ. What kind of music would you like to listen to today?",
  },
  "chat.error": {
    zh: "抱歉，我现在有点累了，稍后再聊好吗？",
    en: "Sorry, I'm a bit tired right now. Can we chat later?",
  },
  "chat.showMore": {
    zh: (n: number) => `展开更多 (${n})`,
    en: (n: number) => `Show more (${n})`,
  },
  "chat.showLess": { zh: "收起", en: "Show less" },
  "chat.playAll": { zh: "播放全部", en: "Play All" },
  "chat.regenerate": { zh: "换一批", en: "Regenerate" },

  // Clock
  "clock.weekdays": { zh: ["日", "一", "二", "三", "四", "五", "六"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
  "clock.date": {
    zh: (p: { year: string; month: string; day: string; weekday: string }) =>
      `${p.year}年${p.month}月${p.day}日 星期${p.weekday}`,
    en: (p: { year: string; month: string; day: string; weekday: string }) =>
      `${p.weekday}, ${p.month}/${p.day}/${p.year}`,
  },

  // Player
  "player.notPlaying": { zh: "未播放", en: "Not Playing" },
  "player.selectSong": { zh: "选择一首歌曲开始播放", en: "Select a song to start playing" },

  // Favorites
  "favorites.title": { zh: "我喜欢的歌曲", en: "My Favorite Songs" },
  "favorites.loading": { zh: "加载中...", en: "Loading..." },
  "favorites.empty": { zh: "还没有收藏的歌曲", en: "No favorite songs yet" },
  "favorites.emptyHint": {
    zh: "在播放器中点击爱心按钮收藏歌曲",
    en: "Click the heart button in the player to favorite songs",
  },

  // Playlist detail
  "playlist.notFound": { zh: "歌单不存在", en: "Playlist not found" },
  "playlist.back": { zh: "返回", en: "Back" },
  "playlist.songCount": { zh: (n: number) => `${n} 首歌`, en: (n: number) => `${n} songs` },
  "playlist.playAll": { zh: "播放全部", en: "Play All" },
  "playlist.empty": { zh: "歌单暂无歌曲", en: "No songs in this playlist" },

  // Settings
  "settings.title": { zh: "设置", en: "Settings" },
  "settings.appearance": { zh: "外观", en: "Appearance" },
  "settings.light": { zh: "浅色", en: "Light" },
  "settings.dark": { zh: "深色", en: "Dark" },
  "settings.fontSize": { zh: "字体大小", en: "Font Size" },
  "settings.fontSmall": { zh: "小", en: "Small" },
  "settings.fontMedium": { zh: "中", en: "Medium" },
  "settings.fontLarge": { zh: "大", en: "Large" },
  "settings.language": { zh: "语言", en: "Language" },
  "settings.playlistSources": { zh: "歌单来源", en: "Playlist Sources" },
  "settings.importPlaylist": { zh: "导入歌单", en: "Import Playlist" },
  "settings.noPlaylists": { zh: "还没有导入歌单", en: "No playlists imported yet" },
  "settings.noPlaylistsHint": {
    zh: "点击上方按钮导入网易云音乐歌单",
    en: "Click the button above to import NetEase Music playlists",
  },
  "settings.noChanges": { zh: "无变化", en: "No changes" },
  "settings.about": { zh: "关于 Claudio", en: "About Claudio" },
  "settings.version": { zh: "版本：0.2.0", en: "Version: 0.2.0" },
  "settings.tagline1": { zh: "一个有温度的 AI 音乐伴侣", en: "A warm AI music companion" },
  "settings.tagline2": { zh: "懂你音乐的知己", en: "A friend who understands your music" },
  "settings.play": { zh: "播放", en: "Play" },
  "settings.sync": { zh: "同步", en: "Sync" },
  "settings.noNeteaseSource": { zh: "无网易云来源", en: "No NetEase source" },
  "settings.delete": { zh: "删除", en: "Delete" },

  // Settings page sections
  "settings.playback": { zh: "播放设置", en: "Playback" },
  "settings.autoPlay": { zh: "开机自动播放", en: "Auto-play on launch" },
  "settings.autoPlayDesc": { zh: "打开页面时自动播放音乐", en: "Automatically play music when page opens" },
  "settings.quickSwitch": { zh: "快速切歌", en: "Quick Switch" },
  "settings.quickSwitchDesc": { zh: "直接播放下一首", en: "Play next song directly" },
  "settings.dynamicBg": { zh: "动态背景", en: "Dynamic Background" },
  "settings.dynamicBgDesc": { zh: "根据专辑封面变化背景颜色", en: "Background color changes with album art" },
  "settings.display": { zh: "显示设置", en: "Display" },
  "settings.themeDesc": { zh: "选择浅色或深色主题", en: "Choose light or dark theme" },
  "settings.langDesc": { zh: "切换界面语言", en: "Switch interface language" },
  "settings.fontSizeDesc": { zh: "调整文字显示大小", en: "Adjust text display size" },
  "settings.data": { zh: "数据管理", en: "Data" },
  "settings.clearCache": { zh: "清除缓存", en: "Clear Cache" },
  "settings.cacheSize": { zh: "当前缓存", en: "Current cache" },
  "settings.clearCacheConfirm": { zh: "确定要清除缓存吗？", en: "Are you sure you want to clear cache?" },

  // Playlists page
  "playlists.title": { zh: "歌单", en: "Playlists" },
  "playlists.liked": { zh: "我喜欢的音乐", en: "Liked Songs" },
  "playlists.imported": { zh: "导入歌单", en: "Imported Playlists" },
  "playlists.songCount": { zh: "首歌", en: "songs" },
  "playlists.deleteConfirm": { zh: "确定要删除这个歌单吗？", en: "Are you sure you want to delete this playlist?" },

  // Import Playlist Modal
  "import.title": { zh: "导入歌单", en: "Import Playlist" },
  "import.myPlaylists": { zh: "我的歌单", en: "My Playlists" },
  "import.localImport": { zh: "本地导入", en: "Local Import" },
  "import.linkImport": { zh: "链接导入", en: "Import by Link" },
  "import.imported": { zh: " · 已导入", en: " · Imported" },
  "import.noPlaylists": { zh: "未获取到歌单", en: "Failed to fetch playlists" },
  "import.loginHint": { zh: "请确认已登录网易云账号", en: "Please confirm you are logged into NetEase" },
  "import.noAvailable": { zh: "没有可导入的歌单", en: "No playlists available to import" },
  "import.enterLink": { zh: "请输入歌单链接或 ID", en: "Please enter a playlist link or ID" },
  "import.invalidId": {
    zh: "无法识别歌单 ID，请输入正确的链接或 ID",
    en: "Cannot recognize playlist ID. Please enter a valid link or ID",
  },
  "import.importFailed": { zh: "导入失败", en: "Import failed" },
  "import.linkLabel": { zh: "歌单链接或 ID", en: "Playlist Link or ID" },
  "import.linkPlaceholder": { zh: "粘贴歌单链接或输入歌单 ID", en: "Paste playlist link or enter playlist ID" },
  "import.supportedFormats": { zh: "支持的格式", en: "Supported formats" },
  "import.formatExample1": {
    zh: "• 歌单链接: https://music.163.com/#/playlist?id=123456",
    en: "• Playlist link: https://music.163.com/#/playlist?id=123456",
  },
  "import.formatExample2": { zh: "• 歌单 ID: 123456", en: "• Playlist ID: 123456" },
  "import.anyPlaylistHint": {
    zh: "可以导入任意网易云歌单，包括别人创建的歌单",
    en: "You can import any NetEase playlist, including those created by others",
  },
  "import.importing": { zh: "导入中...", en: "Importing..." },
  "import.importSelected": {
    zh: (n: number) => `导入选中的 ${n} 个歌单`,
    en: (n: number) => `Import ${n} selected playlists`,
  },

  // User Profile Card
  "profile.title": { zh: "个人资料", en: "Profile" },
  "profile.enterNickname": { zh: "输入昵称", en: "Enter nickname" },
  "profile.clickToEdit": { zh: "点击编辑昵称", en: "Click to edit nickname" },
  "profile.noNickname": { zh: "未设置昵称", en: "No nickname set" },
  "profile.connected": { zh: "已连接网易云", en: "Connected to NetEase" },
  "profile.disconnect": { zh: "断开", en: "Disconnect" },
  "profile.notConnected": { zh: "未连接网易云", en: "Not connected to NetEase" },
  "profile.scanLogin": { zh: "扫码登录网易云音乐", en: "Scan QR to log into NetEase Music" },
  "profile.scanHint": {
    zh: "请使用网易云音乐 App 扫描二维码",
    en: "Please use the NetEase Music app to scan the QR code",
  },
  "profile.scanned": { zh: "扫描成功，请在手机上确认", en: "Scan successful, please confirm on your phone" },
  "profile.qrExpired": { zh: "二维码已过期", en: "QR code expired" },
  "profile.refresh": { zh: "刷新", en: "Refresh" },
  "profile.retry": { zh: "重试", en: "Retry" },
  "profile.scanAlt": { zh: "扫码登录", en: "Scan to login" },
  "profile.editHint": {
    zh: "点击头像可上传自定义图片，点击昵称可编辑",
    en: "Click avatar to upload a custom image, click nickname to edit",
  },
  "profile.loginHint": {
    zh: "登录后可同步歌单、收藏等功能",
    en: "After logging in you can sync playlists, favorites, etc.",
  },

  // Toast messages
  "toast.loginSuccess": { zh: "网易云音乐登录成功", en: "NetEase Music login successful" },
  "toast.avatarUpdated": { zh: "头像更新成功", en: "Avatar updated successfully" },
  "toast.avatarFailed": { zh: "头像上传失败", en: "Avatar upload failed" },
  "toast.nicknameSaved": { zh: "昵称已保存", en: "Nickname saved" },
  "toast.nicknameFailed": { zh: "昵称保存失败", en: "Nickname save failed" },
  "toast.disconnected": { zh: "已断开网易云连接", en: "NetEase connection disconnected" },
  "toast.disconnectFailed": { zh: "断开连接失败", en: "Failed to disconnect" },
  "toast.qrGenerateFailed": { zh: "生成二维码失败", en: "Failed to generate QR code" },
  "toast.qrGenerateFailedRetry": { zh: "生成二维码失败，请重试", en: "Failed to generate QR code, please retry" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string;
export function t(key: TranslationKey, lang: Lang, param: number): string;
export function t(key: TranslationKey, lang: Lang, param: Record<string, string>): string;
export function t(key: TranslationKey, lang: Lang, param?: number | Record<string, string>): string {
  const entry = translations[key];
  const value = entry[lang] ?? entry.zh;

  if (typeof value === "function") {
    return value(param as never);
  }
  return value as string;
}

export function tArr(key: TranslationKey, lang: Lang): string[] {
  const entry = translations[key];
  const value = entry[lang] ?? entry.zh;
  return value as unknown as string[];
}
