import { NextResponse } from "next/server";

/**
 * OAuth 授权登录已废弃
 * 当前使用 NeteaseCloudMusicApi 的 QR 码登录
 */
export async function GET() {
  return NextResponse.json(
    { error: "OAuth 授权登录已停用，请使用二维码登录" },
    { status: 400 }
  );
}
