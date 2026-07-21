import { NextRequest, NextResponse } from "next/server";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { clearCookieCache } from "@/app/lib/music";

export async function POST(request: NextRequest) {
  try {
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json(
        { error: "请输入手机号和密码" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.MUSIC_API_URL;
    if (!apiUrl) {
      return NextResponse.json(
        { error: "音乐服务未配置" },
        { status: 500 }
      );
    }

    const res = await fetch(`${apiUrl}/login/cellphone`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ phone, password }).toString(),
    });
    const data = await res.json();

    if (data.code !== 200) {
      console.error("Phone login failed:", JSON.stringify(data));
      return NextResponse.json(
        { error: data.msg || data.message || "手机号或密码错误" },
        { status: 401 }
      );
    }

    // 保存 cookie
    if (data.cookie) {
      const cookiePath = resolve(process.cwd(), ".netease-cookie");
      writeFileSync(cookiePath, data.cookie, "utf-8");
      clearCookieCache();
    }

    return NextResponse.json({
      success: true,
      profile: data.profile
        ? {
            nickname: data.profile.nickname,
            avatarUrl: data.profile.avatarUrl,
            userId: data.profile.userId,
          }
        : null,
    });
  } catch (error) {
    console.error("Phone login error:", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
