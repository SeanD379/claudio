import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth 回调已废弃
 * 当前使用 NeteaseCloudMusicApi 的 QR 码登录
 */
export async function GET(request: NextRequest) {
  // 重定向回主页
  return NextResponse.redirect(
    new URL("/?error=oauth_deprecated", request.url)
  );
}
