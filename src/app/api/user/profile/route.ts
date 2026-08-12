import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getUserProfile, hasUserToken } from "@/app/lib/netease-token";

const userId = "default-user";

// 获取用户资料
export async function GET() {
  try {
    // 从数据库获取本地用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // 尝试获取网易云用户信息
    let neteaseProfile = null;
    if (await hasUserToken()) {
      try {
        neteaseProfile = await getUserProfile();
      } catch (err) {
        console.log("Failed to fetch netease profile:", err);
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
