import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "mysql://root:13535642180Dsx!@localhost:3306/claudio",
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // NeteaseCloudMusicApi 保持外部模块（其 main.js 使用动态 require，无法被打包）
  serverExternalPackages: ["NeteaseCloudMusicApi"],
  // 强制将 NCM 的间接依赖包含进部署追踪产物：
  // 我们代码不直接 require xml2js，Netlify 的 nft 追踪会把它剪掉，
  // 导致线上函数运行时 Cannot find module 'xml2js'。
  outputFileTracingIncludes: {
    "/api/netease/**": [
      "./node_modules/xml2js/**",
      "./node_modules/xmlbuilder/**",
      "./node_modules/sax/**",
      "./node_modules/qrcode/**",
      "./node_modules/dijkstrajs/**",
      "./node_modules/pngjs/**",
      "./node_modules/NeteaseCloudMusicApi/module/playlist_detail.js",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "p1.music.126.net" },
      { protocol: "https" as const, hostname: "p2.music.126.net" },
      { protocol: "https" as const, hostname: "p3.music.126.net" },
      { protocol: "https" as const, hostname: "p4.music.126.net" },
    ],
  },
  // 注意：不要设置 output: "standalone"，
  // 它与 @netlify/plugin-nextjs 的产物布局冲突，会导致函数运行时崩溃
};

export default nextConfig;
