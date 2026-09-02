import { NextRequest, NextResponse } from "next/server";
import { generateQrCode, checkQrStatus } from "@/app/lib/ncm-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "generate") {
      const result = await generateQrCode();
      if (!result) {
        return NextResponse.json(
          { error: "生成二维码失败" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        key: result.uniKey,
        qrImg: result.qrImg, // base64 图片
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

      const result = await checkQrStatus(key);
      return NextResponse.json({ code: result.status });
    }

    return NextResponse.json(
      { error: "无效的 action 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[QR Login] 错误:", error);
    return NextResponse.json(
      {
        error: "二维码登录失败，请稍后重试",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
