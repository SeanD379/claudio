import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getUserProfile, getValidCookie } from "@/app/lib/ncm-auth";

const NCM_API_BASE = process.env.NCM_API_URL || "http://localhost:3001";

// 获取用户网易云账号的歌单列表
export async function GET() {
  try {
    const cookie = await getValidCookie();
    if (!cookie) {
      return NextResponse.json(
        { error: "未登录网易云账号" },
        { status: 401 }
      );
    }

    // 获取用户信息
    const profile = await getUserProfile();
    if (!profile) {
      return NextResponse.json(
        { error: "未登录网易云账号" },
        { status: 401 }
      );
    }

    // 获取用户歌单
    const res = await fetch(
      `${NCM_API_BASE}/user/playlist?uid=${profile.userId}&cookie=${encodeURIComponent(cookie)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json() as {
      code: number;
      playlist?: Array<{
        id: number;
        name: string;
        trackCount: number;
        coverImgUrl: string;
        creator?: { nickname: string };
      }>;
    };

    if (data.code !== 200 || !data.playlist) {
      return NextResponse.json({ playlists: [] });
    }

    // 查询已导入的歌单 neteaseId
    const imported = await prisma.playlist.findMany({
      where: { userId: "default-user", neteaseId: { not: null } },
      select: { neteaseId: true },
    });
    const importedIds = new Set(
      imported.map((p) => p.neteaseId).filter(Boolean)
    );

    const playlists = data.playlist.map((p) => ({
      playlistId: p.id,
      name: p.name,
      trackCount: p.trackCount,
      coverUrl: p.coverImgUrl,
      creator: p.creator?.nickname || "",
      imported: importedIds.has(p.id.toString()),
      isMine: p.creator?.nickname === profile.nickname,
    }));

    return NextResponse.json({ playlists });
  } catch (error) {
    console.error("Get netease playlists error:", error);
    return NextResponse.json(
      { error: "获取歌单列表失败" },
      { status: 500 }
    );
  }
}
