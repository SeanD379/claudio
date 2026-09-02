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
  // NeteaseCloudMusicApi 不打包，运行时动态导入
  serverExternalPackages: ["NeteaseCloudMusicApi"],
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
