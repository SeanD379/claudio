# 2026-11-17 Netlify 发布与验收记录

## 最终结果

- 正式网址：https://claudio-music.netlify.app
- 站点 ID：`40deb165-7698-4fec-aca8-996f2a64930f`。
- 最终部署 ID：`6afbbc1a005c3a814f230d64`，Netlify 状态 `ready`，上下文 `production`。
- 发布时间：2026-11-17 10:30:28（Asia/Shanghai）；API 原始时间为 `2026-11-17T02:30:28.658Z`。
- **用户已在本次对话确认：重新扫码后可以播放。** 这是用户的真实账号播放验收；自动化接口检查使用匿名会话，二者分别记录。
- 72 项测试通过；主项目类型检查、相关新增代码 ESLint、Netlify 适配构建和登录/歌单/播放依赖追踪检查通过。
- 148 个发布源文件与主目录逐一比较 SHA-256，一致后构建、发布；源码清单保存在 D 盘证据目录。
- 保留未提交工作，未执行 Git 提交或推送。发布未执行数据库结构同步，未修改线上数据库密钥。

## 发布过程中发现并处理的问题

| 编号 | 证据与判断 | 处理及状态 |
| --- | --- | --- |
| DEPLOY-01 | 原 Netlify 构建命令包含 `prisma db push --accept-data-loss`；本轮没有数据库模型变更需求。 | 增加 `build:netlify` 脚本，仅生成客户端、构建应用及检查依赖；部署不再自动同步表结构。已完成。 |
| DEPLOY-02 | 本机生成的 Prisma 客户端仅有 Windows 引擎。 | 生成目标增加 `rhel-openssl-3.0.x`，打包后检查 Linux 引擎存在；线上数据库读取 200。已完成。目标选择参考 [Prisma Netlify 部署说明](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-netlify)。 |
| DEPLOY-03 | Turbopack 输出含 Prisma 包目录链接；Netlify 插件复制时发生 Windows `EPERM / symlink`。 | 发布专用脚本使用 Next.js 支持的 `--webpack`；本地原有普通构建脚本保留。适配构建通过。 |
| DEPLOY-04 | Netlify 对本地工具返回数据库密钥的遮罩值；原 `next.config.ts` 会在构建时将该值固定到应用中。 | 删除 Next 配置中的 `env.DATABASE_URL` 及硬编码本地数据库回退，数据库地址由服务器运行时读取。产物检查确认不包含构建占位地址，线上数据库读取成功。 |
| DEPLOY-05 | 独立 `netlify build` 结束后，插件将原 `.next` 恢复；直接对该目录执行 `deploy --no-build` 会选择错误的静态资源集合。 | 发布使用插件生成的部署配置和 `.netlify/static`，同时携带内部函数产物。最终上传集合为 79 个文件及 1 个函数，未将整个构建目录作为公开资源发布。 |
| DEPLOY-06 | 首轮正式版 `6afb43cfb999a17056f58612` 的播放接口约 6 ms 即返回 502。保留的旧诊断接口在实际函数中报告 `NETLIFY=false` 并尝试本地 HTTP 请求失败。 | 已回退至原版 `6a9995b6a127cc0008a67cf5`。运行环境识别增加 Lambda 标记，避免云端访问 `localhost:3001`。新增回归先失败后通过；最终扫码播放已获用户确认。 |
| DEPLOY-07 | 音乐包装层仍整包导入 SDK；认证层之前已避免这种方式，因为它会加载大量无关模块。 | 音乐调用改为按需导入 SDK 子模块，补齐类型声明及播放路由依赖检查。整包依赖失败与 Lambda 环境识别分别有回归覆盖，不将整包问题认定为首轮 502 的唯一原因。 |
| DEPLOY-08 | 匿名请求的旧取流接口返回空地址；新版接口也可能失败或返回错误响应。 | 空地址时仅做一次 SDK v1 回退，使用对应原 320 kbps 的 `exhigh` 等级。回退抛错或返回错误体时保留原不可用结果；鉴权错误仍明确反馈。覆盖成功回退、异常、错误体，避免把空地址当播放成功。 |
| DEPLOY-09 | 上传过程中多次出现到 Netlify/S3 的 TLS 断连。 | 使用本次进程内的幂等请求重试及系统 HTTPS 传输完成上传，保留证书校验；凭证不进入命令参数或日志。未修改系统代理或网络设置。 |

预览部署 `6afb41602ab1298903d3caef` 受 Netlify 团队登录保护，匿名访问返回登录重定向及 401。未修改保护设置；正式网址通过公开 HTTP 检查后，再由用户实际扫码确认播放。

## 最终线上检查

检查报告：`D:/CodexData/outputs/claudio/netlify-production-acceptance-smoke-20261117.json`。

| 检查 | 结果 | 证据边界 |
| --- | --- | --- |
| 首页 | 200，标题 `Claudio - AI 私人 DJ`，存在 Next 静态资源引用 | HTTP 检查，不等于浏览器绘制性能验收。 |
| 新增占位封面 | 200，`image/svg+xml` | 证明静态发布目录及该资源正确。 |
| 无效歌曲参数 | 400；关联 ID 原样返回；`private,no-store` | 验证参数错误及日志关联。 |
| 生成二维码 | 200，具有 key 和二维码图片；`private,no-store` | 自动化未扫码，不保存或输出二维码 key。 |
| 数据库只读查询 | 200 | 证明最终函数中的 Linux 引擎和数据库运行时配置可用。 |
| 匿名试播 `29357087` | 应用 HTTP 200，`audioUrl:null`、`unavailable`；上游歌曲状态码 404 | 严格播放检查项未通过；不据此认定删除、版权、地区或账号是唯一原因，也不把 HTTP 200 当作可播放。 |
| 用户扫码后试播 | 用户明确回复“扫码后可以播放” | 真实账号播放验收通过；未对起播 P90、弱网或真机温度作结论。 |

匿名样本关联 ID：`b42da8d7-1015-4e1b-a174-a1159ebe8e45`。该次响应：`song_url;dur=3080.7, music_upstream;desc="404"`。HTTP 探针约 4.26 秒，含网络开销；不等于真实起播时间。原始探针对音源地址采用严格成功条件，因此进程退出码为 1，报告中的失败项原样保留。后续用户登录播放确认单独记录，未改写匿名样本结果。

## 溯源与复现

证据统一位于 `D:/CodexData/outputs/claudio/`：

- `netlify-release-final-tests-20261117.txt`：72 项测试。
- `netlify-final-release-build-20261117.log`：最终 Netlify 适配构建与依赖检查。
- `netlify-final-production-publish-20261117.log`：最终正式发布日志与部署 ID。
- `netlify-status-20261117.json`：最终已发布版本、`ready` 状态及发布时间。
- `netlify-release-final-source-manifest-20261117.json`：148 个源文件的主目录/发布目录摘要。
- `netlify-runtime-before-fix-20261117.txt`：云端运行识别和整包依赖回归的修复前失败证据。
- `netlify-fallback-error-body-before-20261117.txt`：新版接口错误体覆盖原不可用结果的修复前证据。
- `netlify-production-smoke-20261117.json`、`netlify-rollback-20261117.json`：首轮故障检查及回滚记录。

发布目录：`D:/CodexData/tmp/claudio/netlify-release-20261117`。其中 `netlify.source.toml` 保存构建所用源配置；根 `netlify.toml` 在独立构建后替换为生成的部署配置，供 `--no-build` 发布。再次构建前应从主目录恢复源配置；再次独立发布时应使用 `.netlify/static` 和匹配的函数产物。

浏览器诊断导出及播放各阶段定义见 [加载性能排查记录](loading-performance-investigation.md)。本次新增 `transport-sdk / transport-http`、v1 回退阶段及允许列表内的失败代码；`Server-Timing` 可附带上游数字状态码。日志不包含 Cookie、Token、完整音频地址或账号资料。

如需回退，在 Netlify Deploys 中选择已验证的上一版本后发布。原版 ID 为 `6a9995b6a127cc0008a67cf5`；当前完成验收的版本为本文最终部署 ID。回退前先核对是否已有其他更新，避免覆盖后续发布。
