import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getUserProfile, hasCookie } from "@/app/lib/ncm-auth";

const userId = "default-user";

// 服务器端存储不可用时的登录态兜底：浏览器会话 Cookie
function getSessionFallback(request: NextRequest): string | undefined {
  return request.cookies.get("nc_netease_session")?.value;
}

// 获取用户资料
export async function GET(request: NextRequest) {
  try {
    const fallbackCookie = getSessionFallback(request);
    // 从数据库获取本地用户信息（数据库不可达时不影响网易云资料返回）
    let user: { nickname: string | null; customAvatarUrl: string | null } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    } catch (dbErr) {
      console.warn("[Profile] 数据库不可达，跳过本地用户信息:", dbErr);
    }

    // 尝试获取网易云用户信息
    let neteaseProfile = null;
    if (await hasCookie(fallbackCookie)) {
      try {
        neteaseProfile = await getUserProfile(fallbackCookie);
      } catch (err) {
        console.log("获取网易云资料失败:", err);
      }
    }

    return NextResponse.json({
      user: {
        id: userId,
        nickname: user?.nickname || neteaseProfile?.nickname || "未设置昵称",
        avatarUrl: neteaseProfile?.avatarUrl || null,
        customAvatarUrl: user?.customAvatarUrl || null,
      },
      neteaseProfile,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    );
  }
}

// 更新用户资料
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, customAvatarUrl } = body;

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        nickname: nickname || undefined,
        customAvatarUrl: customAvatarUrl !== undefined ? customAvatarUrl : undefined,
      },
      create: {
        id: userId,
        nickname: nickname || "未设置昵称",
        customAvatarUrl: customAvatarUrl || null,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        customAvatarUrl: user.customAvatarUrl,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
