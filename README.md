# Claudio

Claudio 是一个可以用聊天点歌的 AI 私人 DJ。你可以直接说出歌名，也可以描述心情或场景。Claudio 根据对话推荐歌曲，通过网易云音乐搜索并把候选曲目接到播放器。

[在线体验](https://claudio-music.netlify.app/) · [产品设计](docs/PRD.md) · [技术设计](docs/TECHNICAL_DESIGN.md)

## 可以做什么

- **对话点歌。** 例如输入「放几首适合雨天写东西的歌」，从对话返回的候选曲目里试听，也可以继续告诉 Claudio 想换什么风格。
- **扫码听歌。** 用网易云音乐账号扫码登录，访问个人歌单和推荐。播放器提供歌词、播放队列和收藏，曲目能否播放取决于网易云返回的音源和当前账号权限。
- **整理歌单。** 导入歌单和管理收藏，把想继续听的曲目留下来。
- **回顾和探索。** 音乐日历可以回看自己的听歌记录。项目还包含沉浸式舞台原型，用来探索舞台画面、歌词和播放的联动。

## 本地运行

需要 Node.js 20.9 或以上版本，以及一个用于开发的 MySQL 数据库。安装依赖：

```bash
npm ci
```

在仓库根目录创建 `.env`，将连接地址替换成自己的开发数据库。对话功能需要 MiMo 的 Anthropic 兼容 API 地址和密钥。

```dotenv
DATABASE_URL="mysql://user:password@127.0.0.1:3306/claudio"
ANTHROPIC_API_URL=""
ANTHROPIC_API_KEY=""
```

在新建的空开发数据库上初始化表结构并启动：

```bash
npx prisma db push
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。开发命令会同时启动网页和本地音乐 API，音乐 API 默认使用 3001 端口。账号登录在页面内通过网易云音乐 App 扫码完成。

## 技术与验证

Next.js App Router、React 和 TypeScript 构建页面与接口，Zustand 管理播放等客户端状态，Prisma 与 MySQL 保存个人数据。对话接入 MiMo，歌曲搜索、音源和歌词来自网易云音乐。

- `npm run test:loading` 检查播放请求和加载流程。
- `npm run test:ncm-auth`、`npm run test:ncm-playlist` 和 `npm run test:playlist-import` 检查登录、歌单读取及导入。
- `npm run build:netlify` 使用 Netlify 构建配置，生成 Prisma 客户端并检查音乐接口依赖。详见[发布与验收记录](docs/netlify-release-20261117.md)。
