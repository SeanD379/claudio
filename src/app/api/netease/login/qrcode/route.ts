import { NextRequest, NextResponse } from "next/server";
import { getQrCode, checkQrCodeStatus } from "@/app/lib/netease-token";

/**
 * 解析短链接，获取最终的长链接
 * 官方 API 可能返回短链接（如 https://163cn.tv/xxx），需要解析后才能正确生成二维码
 */
async function resolveUrl(url: string): Promise<string> {
  // 如果不是短链接（包含/music 或 /discover 等路径），直接返回
  if (url.includes("music.163.com") || url.includes("y.qq.com")) {
    return url;
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const finalUrl = response.url;
    console.log("[QR] Resolved URL:", url, "->", finalUrl);
    return finalUrl;
  } catch (error) {
    console.warn("[QR] Failed to resolve URL:", url, "- using original");
    return url;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "generate") {
      const data = await getQrCode();
      console.log("[QR] Generated QR code URL:", data.qrCodeUrl, "uniKey:", data.uniKey);

      // 解析短链接，确保二维码内容是完整的 URL
      const resolvedUrl = await resolveUrl(data.qrCodeUrl);

      // 使用免费 QR 码图片 API 生成二维码
      const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(resolvedUrl)}`;
      return NextResponse.json({
        key: data.uniKey,
        qrImg,
        originalUrl: data.qrCodeUrl,
        resolvedUrl,
      });
    }

    if (action === "check") {
      const key = searchParams.get("key");
      if (!key) {
        return NextResponse.json(
          { error: "缺少 key 参数" },
          { status: 400 }
        );
      }

      const result = await checkQrCodeStatus(key);

      // 映射状态码以保持前端兼容
      const statusCodeMap: Record<string, number> = {
        expired: 800,
        waiting: 801,
        scanned: 802,
        confirmed: 803,
      };

      const code = statusCodeMap[result.status] || 801;

      return NextResponse.json({ code });
    }

    return NextResponse.json(
      { error: "无效的 action 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("QR login error:", error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "no stack");
    console.error("NETEASE_APP_ID set:", !!process.env.NETEASE_APP_ID);
    console.error("NETEASE_APP_SECRET set:", !!process.env.NETEASE_APP_SECRET);
    console.error("NETEASE_PRIVATE_KEY set:", !!process.env.NETEASE_PRIVATE_KEY);
    console.error("NETEASE_PRIVATE_KEY length:", process.env.NETEASE_PRIVATE_KEY?.length || 0);
    return NextResponse.json(
      { error: "二维码登录失败，请稍后重试", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
