import { NextRequest, NextResponse } from "next/server";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { clearCookieCache } from "@/app/lib/music";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const apiUrl = process.env.MUSIC_API_URL;
    if (!apiUrl) {
      return NextResponse.json(
        { error: "音乐服务未配置" },
        { status: 500 }
      );
    }

    if (action === "generate") {
      const keyRes = await fetch(`${apiUrl}/login/qr/key`);
      const keyData = await keyRes.json();
      const unikey = keyData.data?.unikey;

      if (!unikey) {
        console.error("QR key response:", JSON.stringify(keyData));
        return NextResponse.json(
          { error: "生成二维码失败" },
          { status: 500 }
        );
      }

      const qrRes = await fetch(
        `${apiUrl}/login/qr/create?key=${encodeURIComponent(unikey)}&qrimg=true`
      );
      const qrData = await qrRes.json();

      return NextResponse.json({
        key: unikey,
        qrImg: qrData.data?.qrimg || null,
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

      const checkRes = await fetch(
        `${apiUrl}/login/qr/check?key=${encodeURIComponent(key)}`
      );
      const checkData = await checkRes.json();
      console.log("QR check raw response:", JSON.stringify(checkData));

      // 网易云API返回格式: {code: 200, data: {code: 800-803, cookie?: "..."}}
      // 也可能直接返回: {code: 800-803, cookie?: "..."}
      const qrStatus = checkData.data?.code ?? checkData.code;
      const cookie = checkData.data?.cookie ?? checkData.cookie;
      console.log("QR status:", qrStatus, "has cookie:", !!cookie);

      // code: 800=过期, 801=等待扫码, 802=已扫码等待确认, 803=成功
      if (qrStatus === 803 && cookie) {
        // 保存 cookie，立刻返回，不等 profile
        const cookiePath = resolve(process.cwd(), ".netease-cookie");
        writeFileSync(cookiePath, cookie, "utf-8");
        clearCookieCache();
        console.log("QR login success, cookie saved");

        return NextResponse.json({ code: 803 });
      }

      return NextResponse.json({ code: qrStatus });
    }

    return NextResponse.json(
      { error: "无效的 action 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("QR login error:", error);
    return NextResponse.json(
      { error: "二维码登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
