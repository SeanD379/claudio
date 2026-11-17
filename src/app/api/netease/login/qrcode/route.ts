import { NextRequest, NextResponse } from "next/server";
import { generateQrCode, checkQrStatus } from "@/app/lib/ncm-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "generate") {
      const result = await generateQrCode();
      if (!result) {
        return NextResponse.json(
          { error: "暂时无法连接网易云音乐，请稍后刷新重试" },
          { status: 502, headers: { "Cache-Control": "private, no-store" } }
        );
      }

      return NextResponse.json({
        key: result.uniKey,
        qrImg: result.qrImg, // base64 图片
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "check") {
      const key = searchParams.get("key");
      if (!key) {
        return NextResponse.json(
          { error: "缺少 key 参数" },
          { status: 400 }
        );
      }

      const result = await checkQrStatus(key);
      if (result.status >= 500 && result.status < 600) {
        return NextResponse.json(
          { code: result.status, error: result.message || "暂时无法连接网易云音乐，正在重试" },
          { status: 502, headers: { "Cache-Control": "private, no-store" } }
        );
      }
      const response = NextResponse.json({
        code: result.status,
        profile: result.profile ?? null,
      }, { headers: { "Cache-Control": "private, no-store" } });

      // 登录成功时把网易云 Cookie 下发为浏览器会话 Cookie，
      // 作为服务器端存储（数据库）不可用时的登录态兜底
      if (result.status === 803 && result.cookie) {
        response.cookies.set("nc_netease_session", result.cookie, {
          httpOnly: true,
          secure: request.nextUrl.protocol === "https:",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return response;
    }

    return NextResponse.json(
      { error: "无效的 action 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[QR Login] 错误:", error);
    return NextResponse.json(
      {
        error: "暂时无法连接网易云音乐，请稍后刷新重试",
      },
      { status: 502, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
