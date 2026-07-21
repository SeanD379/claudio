# Claudio 技术方案文档

> 当前版本：v0.2.3 · 更新日期：2026-05-30

## 1. 技术架构

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                    前端（Next.js App Router）              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐ │
│  │  首页   │  │  收藏   │  │  设置   │  │歌单详情页 │ │
│  │时钟+播放│  │ 歌曲列表│  │ 个人资料│  │ 歌曲列表  │ │
│  │ +对话   │  │         │  │ 歌单管理│  │           │ │
│  └─────────┘  └─────────┘  └─────────┘  └───────────┘ │
├─────────────────────────────────────────────────────────┤
│  状态管理：Zustand（usePlayer / useTheme / useFavorites  │
│           / usePlaylists / useTTS / useToast）           │
│  动画：Framer Motion · 国际化：自定义 i18n               │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  API Routes（19 个端点）                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ 音乐 API │  │ AI 对话  │  │ TTS 语音 │  │用户管理 ││
│  │ 搜索/详情│  │ 聊天/旁白│  │ 合成     │  │收藏/歌单││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│  ┌──────────┐                                           │
│  │网易云登录│  扫码 / 手机号 / 断开                      │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    数据层                                │
│  ┌─────────────────────┐  ┌───────────────────────────┐│
│  │ MySQL 8.x (Prisma)  │  │ 文件系统                  ││
│  │ 7 个模型             │  │ .netease-cookie           ││
│  │ User/Song/Favorite   │  │ public/uploads/avatars/   ││
│  │ Playlist/Setting...  │  │ docs/playlists-export.json││
│  └─────────────────────┘  └───────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   外部服务                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐│
│  │ MiMo API     │  │ MiMo TTS     │  │网易云音乐 API ││
│  │ AI 对话      │  │ 语音合成      │  │(NeteaseCloud  ││
│  │ mimo-v2.5-pro│  │ mimo-v2.5-tts│  │ MusicApi)     ││
│  └──────────────┘  └──────────────┘  └───────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | Next.js | 16.2.6 | App Router，Turbopack |
| **UI 框架** | React | 19.2.4 | |
| **CSS** | TailwindCSS | 4.x | `@theme inline` + CSS 变量 |
| **动画** | Framer Motion | 12.40.0 | `AnimatePresence`、spring 动画 |
| **状态管理** | Zustand | 5.0.13 | 6 个独立 store |
| **图标** | Lucide React | 1.16.0 | 线条图标库 |
| **后端** | Next.js API Routes | 16.2.6 | 19 个端点 |
| **数据库** | MySQL | 8.x | |
| **ORM** | Prisma | 5.22.0 | 7 个模型 |
| **AI 对话** | MiMo API | mimo-v2.5-pro | Anthropic 兼容协议 |
| **语音合成** | MiMo TTS | mimo-v2.5-tts | 中文「冰糖」/ 英文「Milo」 |
| **音乐源** | NeteaseCloudMusicApi | 4.32.0 | 网易云音乐第三方 API |
| **并发启动** | concurrently | 10.0.0 | 同时启动 music-api + next dev |
| **语言** | TypeScript | 5.x | |

---

## 2. 项目结构

```
claudio/
├── docs/                              # 文档
│   ├── PRD.md                         # 产品设计文档
│   ├── TECHNICAL_DESIGN.md            # 技术方案文档（本文件）
│   ├── CHANGELOG.md                   # 版本更新日志
│   ├── TIMELINE.md                    # 开发时间表
│   ├── DESIGN.md                      # UI 设计系统文档
│   ├── INSIGHT_REPORT.md              # 项目分析报告
│   ├── playlists-export.json          # 歌单导出数据
│   ├── playlist-snapshot.json         # 歌单快照
│   └── check-playlist-changes.mjs     # 歌单变化检测脚本
│
├── prisma/
│   ├── schema.prisma                  # 数据库模型定义（7 个模型）
│   └── migrations/                    # 数据库迁移
│
├── scripts/
│   └── start-music-api.js             # NeteaseCloudMusicApi 启动脚本
│
├── public/                            # 静态资源（SVG 图标）
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # 根布局（ThemeProvider + Navbar + Toast）
│   │   ├── page.tsx                   # 首页（时钟 + 播放器 + 对话，双栏布局）
│   │   ├── globals.css                # 全局样式（"The Listening Room" 设计系统）
│   │   │
│   │   ├── favorites/
│   │   │   └── page.tsx               # 收藏页
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx               # 设置页（个人资料 + 主题 + 字体 + 语言 + 歌单管理）
│   │   │
│   │   ├── playlists/
│   │   │   └── [id]/
│   │   │       └── page.tsx           # 歌单详情页
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx         # 底部导航栏（动画指示器）
│   │   │   │   └── ThemeProvider.tsx   # 主题初始化
│   │   │   │
│   │   │   ├── home/
│   │   │   │   ├── Clock.tsx          # 时钟（衬线字体 + 脉冲冒号）
│   │   │   │   ├── Player.tsx         # 播放器（旋转封面 + 色彩渗透）
│   │   │   │   ├── Chat.tsx           # AI 对话（消息 + 推荐列表 + TTS）
│   │   │   │   └── SongList.tsx       # 可折叠歌曲列表
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── UserProfileCard.tsx    # 个人资料（头像 + 昵称 + 扫码登录）
│   │   │   │   └── ImportPlaylistModal.tsx # 歌单导入弹窗（三标签页）
│   │   │   │
│   │   │   └── common/
│   │   │       └── Toast.tsx          # Toast 通知
│   │   │
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   ├── route.ts           # AI 对话
│   │   │   │   └── narrate/route.ts   # 歌曲旁白生成
│   │   │   │
│   │   │   ├── tts/
│   │   │   │   └── route.ts           # TTS 语音合成
│   │   │   │
│   │   │   ├── music/
│   │   │   │   ├── search/route.ts    # 歌曲搜索
│   │   │   │   ├── song/route.ts      # 单曲详情 + 播放链接
│   │   │   │   ├── songs/route.ts     # 批量歌曲详情
│   │   │   │   └── playlist/route.ts  # 歌单详情 / 个性化推荐 / 每日推荐
│   │   │   │
│   │   │   ├── user/
│   │   │   │   ├── settings/route.ts  # 用户设置
│   │   │   │   ├── favorites/route.ts # 收藏管理
│   │   │   │   ├── profile/route.ts   # 个人资料
│   │   │   │   ├── avatar/route.ts    # 头像上传
│   │   │   │   └── playlists/
│   │   │   │       ├── route.ts                   # 歌单增删查
│   │   │   │       ├── sync/route.ts              # 歌单同步
│   │   │   │       ├── import-available/route.ts   # 可导入歌单
│   │   │   │       ├── netease-mine/route.ts       # 网易云账号歌单
│   │   │   │       ├── all-songs/route.ts          # 全部歌单歌曲
│   │   │   │       └── [id]/songs/route.ts         # 歌单内歌曲
│   │   │   │
│   │   │   └── netease/
│   │   │       └── login/
│   │   │           ├── qrcode/route.ts    # 扫码登录
│   │   │           ├── phone/route.ts     # 手机号登录
│   │   │           └── disconnect/route.ts # 断开连接
│   │   │
│   │   └── lib/
│   │       ├── db.ts                  # Prisma 客户端单例
│   │       ├── mimo.ts                # MiMo AI API（对话 + 旁白）
│   │       ├── music.ts               # 网易云音乐 API 封装
│   │       └── fish-audio.ts          # MiMo TTS 语音合成
│   │
│   ├── hooks/
│   │   ├── usePlayer.ts               # 播放器状态（Zustand）
│   │   ├── useTheme.ts                # 主题/设置状态（Zustand）
│   │   ├── useTranslation.ts          # 国际化 Hook
│   │   ├── useFavorites.ts            # 收藏状态（Zustand）
│   │   ├── usePlaylists.ts            # 歌单状态（Zustand）
│   │   ├── useTTS.ts                  # TTS 状态（Zustand）
│   │   ├── useNarration.ts            # 旁白逻辑（React Hook）
│   │   └── useToast.ts                # Toast 通知状态（Zustand）
│   │
│   └── i18n/
│       └── translations.ts            # 翻译定义（86 键，中/英）
│
├── .env.local                         # 环境变量
├── .netease-cookie                    # 网易云登录 Cookie
├── package.json                       # 项目配置
├── tsconfig.json                      # TypeScript 配置
├── next.config.ts                     # Next.js 配置
├── postcss.config.mjs                 # PostCSS 配置
└── eslint.config.mjs                  # ESLint 配置
```

---

## 3. 数据库设计

### 3.1 Prisma Schema（7 个模型）

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id             String        @id @default(cuid())
  nickname       String?
  customAvatarUrl String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  settings       UserSetting?
  favorites      Favorite[]
  playlists      Playlist[]
  chatHistory    ChatHistory[]
}

model UserSetting {
  id        String   @id @default(cuid())
  userId    String   @unique
  theme     String   @default("light")    // light | dark
  fontSize  String   @default("medium")   // small | medium | large
  language  String   @default("zh")       // zh | en
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
}

model Song {
  id            String         @id @default(cuid())
  neteaseId     String         @unique
  title         String
  artist        String
  album         String?
  coverUrl      String?
  duration      Int?           // 秒
  createdAt     DateTime       @default(now())
  favorites     Favorite[]
  playlistSongs PlaylistSong[]
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  songId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  song      Song     @relation(fields: [songId], references: [id])
  @@unique([userId, songId])
}

model Playlist {
  id           String         @id @default(cuid())
  userId       String
  neteaseId    String?        // 用于同步
  name         String
  description  String?
  coverUrl     String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  user         User           @relation(fields: [userId], references: [id])
  songs        PlaylistSong[]
}

model PlaylistSong {
  id         String     @id @default(cuid())
  playlistId String
  songId     String
  addedAt    DateTime   @default(now())
  playlist   Playlist   @relation(fields: [playlistId], references: [id])
  song       Song       @relation(fields: [songId], references: [id])
  @@unique([playlistId, songId])
}

model ChatHistory {
  id        String   @id @default(cuid())
  userId    String
  role      String   // user | assistant
  content   String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

### 3.2 注意事项
- 当前所有用户相关 API 使用硬编码 `"default-user"` ID，无真实认证系统
- `ChatHistory` 模型已定义但尚未被 API 写入，对话仅存储在客户端 sessionStorage
- 歌曲通过 `neteaseId` 唯一标识，与网易云音乐一一对应

---

## 4. 状态管理（Zustand Stores）

### 4.1 usePlayer — 播放器核心
```
状态: currentSong, playlist[], isPlaying, progress, currentTime, volume,
      isLoading, playMode (sequential|shuffle|repeat-one|repeat-all),
      shuffleOrder[], beforePlay callback, onPlaylistEnd callback
方法: initAudio, playSong, togglePlay, nextSong, prevSong, setVolume,
      seekTo, setPlaylist, setAndPlay, searchAndPlay, cycleRepeat,
      duckVolume, restoreVolume
```
- 管理全局单例 `HTMLAudioElement`
- Shuffle 模式使用 Fisher-Yates 洗牌算法
- `beforePlay` 回调用于旁白系统（播完旁白后才播放音乐）
- `onPlaylistEnd` 回调用于播完续播流程
- 音量闪避：`duckVolume()` 降低到 20%，`restoreVolume()` 恢复

### 4.2 useTheme — 主题与设置
```
状态: theme (light|dark), fontSize (small|medium|large), language (zh|en)
方法: setTheme, setFontSize, setLanguage, toggleTheme, fetchSettings, saveSettings
```
- `fetchSettings()` 从数据库加载 → `saveSettings()` 写回数据库
- 主题切换通过 `document.documentElement.classList.toggle("dark")`
- 字体大小通过 CSS 变量 `--text-scale` 缩放

### 4.3 useFavorites — 收藏管理
```
状态: favorites[]
方法: fetchFavorites, addFavorite, removeFavorite, isFavorite
```

### 4.4 usePlaylists — 歌单管理
```
状态: playlists[], syncLoading{}, syncResults{}
方法: fetchPlaylists, fetchImportable, fetchNeteasePlaylists,
      importFromExport, importFromNetease, deletePlaylist,
      syncPlaylist, playPlaylist, playAllSongs
```
- `playAllSongs()` 聚合所有歌单 + 收藏歌曲，去重后随机播放

### 4.5 useTTS — 语音合成
```
状态: isPlaying, isLoading, enabled, currentMessageId
方法: toggle, speak, speakAndWait, speakAndWaitWithAudio, stop
```
- `speak()` 异步播放（fire-and-forget），自动调用 `duckVolume()`/`restoreVolume()`
- `speakAndWait()` 播放并等待完成（用于旁白）
- `speakAndWaitWithAudio()` 播放预获取的音频 URL

### 4.6 useToast — 通知
```
状态: toasts[]
方法: addToast(message, type), removeToast(id)
```
- 自动 3 秒后移除

---

## 5. 核心流程

### 5.1 AI 对话流程
```
用户输入 → POST /api/chat → MiMo API（结构化 JSON）
  → { reply, searchKeyword, songs[] }
  → reply 显示在对话中
  → searchKeyword 存在则自动搜索播放
  → songs 存在则显示推荐列表（可折叠）
  → speak() 朗读 reply（如果 TTS 开启）
```

### 5.2 歌曲旁白流程
```
usePlayer.subscribe 监听 currentSong 变化
  → useNarration.beforePlay 回调触发
  → POST /api/chat/narrate → MiMo 生成旁白文字
  → 旁白文字显示在对话中
  → TTS 朗读旁白（speakAndWait）
  → 朗读完成 → 恢复音乐音量 → 歌曲开始播放

预缓存机制：
  - 监听 playlist 变化
  - 对当前歌曲 + 后 5 首歌预生成旁白文字 + TTS 音频
  - 缓存存储在内存 Map 中
  - 切歌时如果缓存命中，直接播放缓存音频
```

### 5.3 播完续播流程
```
playAllSongs() 设置 onPlaylistEnd 回调
  → 歌曲播完，usePlayer 检测到 playlist 末尾
  → 触发 onPlaylistEnd
  → Chat 组件显示「要不要继续来一波？」消息
  → 用户点「继续」→ 再调用 /api/chat 推荐 20 首 → 无缝接续播放
  → 用户点「停止」→ 恢复推荐前的 playlist 和 currentSong
```

### 5.4 网易云扫码登录流程
```
1. GET /api/netease/login/qrcode?action=generate
   → 返回 key + qrImg（base64 图片）
2. 前端显示二维码，开始轮询
3. GET /api/netease/login/qrcode?action=check&key=xxx
   → 801: 等待扫码 → 继续轮询
   → 802: 已扫码 → 显示「已扫码，请确认」
   → 803: 登录成功 → 保存 cookie 到 .netease-cookie → 刷新用户信息
   → 800: 二维码过期 → 提示刷新
4. cookie 自动加载到 NeteaseCloudMusicApi
```

---

## 6. 环境变量

```bash
# 数据库
DATABASE_URL="mysql://root:@localhost:3306/claudio"

# MiMo AI 对话（Anthropic 兼容协议）
ANTHROPIC_API_URL="https://token-plan-cn.xiaomimimo.com/anthropic"
ANTHROPIC_API_KEY="your-api-key"

# MiMo TTS 语音合成
MIMO_API_KEY="your-mimo-api-key"

# 网易云音乐 API
MUSIC_API_URL="http://localhost:3001"

# 应用地址
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 7. 启动与开发

### 7.1 启动命令
```bash
# 开发模式（同时启动 music-api + Next.js）
npm run dev

# 仅启动音乐 API
npm run music-api

# 构建
npm run build

# 生产启动
npm start
```

### 7.2 前置依赖
- Node.js 18+
- MySQL 8.x（数据库名 `claudio`）
- NeteaseCloudMusicApi 通过 npm 包自动启动（端口 3001）

### 7.3 数据库初始化
```bash
npx prisma migrate dev
```

---

## 8. 部署方案

### 8.1 开发环境
- `concurrently` 同时启动 music-api（端口 3001）和 Next.js dev（端口 3000）
- 本地 MySQL 数据库
- Cookie 文件 `.netease-cookie` 存储登录凭证

### 8.2 生产环境建议
- **前端**：Vercel 或自建 Node.js 服务
- **数据库**：PlanetScale / 自建 MySQL
- **音乐 API**：独立部署 NeteaseCloudMusicApi（需单独进程）
- **Cookie 同步**：生产环境需将 `.netease-cookie` 持久化

---

## 9. 已知限制

1. **无真实用户认证**：所有 API 使用硬编码 `"default-user"` ID
2. **对话未持久化**：`ChatHistory` 模型已定义但未使用，对话仅在 sessionStorage
3. **TTS 文件命名**：`fish-audio.ts` 实际使用 MiMo TTS API（非 Fish Audio）
4. **版本号不一致**：package.json 为 `0.1.0`，CHANGELOG 已到 `v0.2.3`
5. **单用户设计**：当前架构不支持多用户并发

---

## 10. 附录

### 10.1 依赖包

**生产依赖**
| 包名 | 版本 | 用途 |
|------|------|------|
| next | 16.2.6 | 前端框架 |
| react / react-dom | 19.2.4 | UI 库 |
| @prisma/client | ^5.22.0 | 数据库 ORM |
| mysql2 | ^3.22.3 | MySQL 驱动 |
| zustand | ^5.0.13 | 状态管理 |
| framer-motion | ^12.40.0 | 动画 |
| lucide-react | ^1.16.0 | 图标 |
| NeteaseCloudMusicApi | ^4.32.0 | 网易云 API |

**开发依赖**
| 包名 | 版本 | 用途 |
|------|------|------|
| tailwindcss | ^4 | CSS 框架 |
| @tailwindcss/postcss | ^4 | PostCSS 插件 |
| typescript | ^5 | 类型系统 |
| prisma | ^5.22.0 | Prisma CLI |
| concurrently | ^10.0.0 | 并发启动 |
| eslint / eslint-config-next | 9 / 16.2.6 | 代码检查 |
