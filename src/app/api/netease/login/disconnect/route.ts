import { NextResponse } from "next/server";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import { clearCookieCache } from "@/app/lib/music";

export async function POST() {
  try {
    const cookiePath = resolve(process.cwd(), ".netease-cookie");

    // 尝试调用网易云登出接口（best-effort）
    try {
      if (existsSync(cookiePath)) {
        const cookie = readFileSync(cookiePath, "utf-8").trim();
        if (cookie) {
          const apiUrl = process.env.MUSIC_API_URL;
          if (apiUrl) {
            await fetch(
              `${apiUrl}/logout?cookie=${encodeURIComponent(cookie)}`
            );
          }
        }
      }
    } catch {
      // 忽略登出接口错误
    }

    // 删除 cookie 文件
    if (existsSync(cookiePath)) {
      unlinkSync(cookiePath);
    }

    // 清除内存缓存
    clearCookieCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: "断开连接失败" },
      { status: 500 }
    );
  }
}
