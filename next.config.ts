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
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "p1.music.126.net" },
      { protocol: "https" as const, hostname: "p2.music.126.net" },
      { protocol: "https" as const, hostname: "p3.music.126.net" },
      { protocol: "https" as const, hostname: "p4.music.126.net" },
    ],
  },
  // Netlify 适配器配置
  output: "standalone",
};

export default nextConfig;
