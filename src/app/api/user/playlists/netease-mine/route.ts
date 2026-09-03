import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getUserProfile, getValidCookie } from "@/app/lib/ncm-auth";

// 服务器端存储不可用时的登录态兜底：浏览器会话 Cookie
function getSessionFallback(request: NextRequest): string | undefined {
  return request.cookies.get("nc_netease_session")?.value;
}

// 获取用户网易云账号的歌单列表
export async function GET(request: NextRequest) {
  try {
    const fallbackCookie = getSessionFallback(request);
    const cookie = await getValidCookie(fallbackCookie);
    if (!cookie) {
      return NextResponse.json(
        { error: "未登录网易云账号" },
        { status: 401 }
      );
    }

    // 获取用户信息
    const profile = await getUserProfile(fallbackCookie);
    if (!profile) {
      return NextResponse.json(
        { error: "未登录网易云账号" },
        { status: 401 }
      );
    }

    // 获取用户歌单（直接调用 NCM 模块，不依赖 localhost:3001）
    const playlistMod = await import("NeteaseCloudMusicApi/module/user_playlist");
    const user_playlist = (playlistMod.default ?? playlistMod) as (
      ...args: unknown[]
    ) => Promise<{ body: unknown }>;
    const requestMod = await import("NeteaseCloudMusicApi/util/request");
    const createRequest = (requestMod.default ?? requestMod) as (
      ...args: unknown[]
    ) => Promise<{ body: unknown }>;
    const res = await user_playlist(
      { uid: profile.userId, cookie, limit: 30 },
      createRequest
    );
    const data = res.body as {
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

    // 查询已导入的歌单 neteaseId（数据库不可达时跳过导入标记）
    let importedIds = new Set<string>();
    try {
      const imported = await prisma.playlist.findMany({
        where: { userId: "default-user", neteaseId: { not: null } },
        select: { neteaseId: true },
      });
      importedIds = new Set(
        imported
          .map((p) => p.neteaseId)
          .filter((id): id is string => Boolean(id))
      );
    } catch (dbErr) {
      console.warn("[Playlists] 数据库不可达，跳过导入标记查询:", dbErr);
    }

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
