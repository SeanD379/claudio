import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { ncmApiGet } from "@/app/lib/netease-open-api";
import { getValidToken, getUserProfile } from "@/app/lib/netease-token";
import type { NcmPlaylist } from "@/app/lib/netease-open-api";

// 获取用户网易云账号的歌单列表
export async function GET() {
  try {
    const token = await getValidToken();

    // 获取用户信息
    const profile = await getUserProfile();
    if (!profile) {
      return NextResponse.json(
        { error: "未登录网易云账号" },
        { status: 401 }
      );
    }

    // 获取用户歌单
    const data = await ncmApiGet<{ playlists: NcmPlaylist[] }>(
      "/openapi/music/basic/playlist/created/get/v2",
      {},
      token
    );

    if (!data.playlists) {
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

    const playlists = data.playlists.map((p) => ({
      playlistId: p.originalId,
      name: p.name,
      trackCount: p.trackCount,
      coverUrl: p.coverImgUrl,
      creator: p.creator?.nickname || "",
      imported: importedIds.has(p.originalId.toString()),
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
