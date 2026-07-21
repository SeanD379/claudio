import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { readFileSync } from "fs";
import { resolve } from "path";

// 获取用户网易云账号的歌单列表
export async function GET() {
  try {
    const cookiePath = resolve(process.cwd(), ".netease-cookie");
    let cookie = "";
    try {
      cookie = readFileSync(cookiePath, "utf-8").trim();
    } catch {
      return NextResponse.json(
        { error: "未登录网易云账号" },
        { status: 401 }
      );
    }

    // 从 cookie 中提取用户 ID
    const uidMatch = cookie.match(/MUSIC_U=[^;]+/);
    if (!uidMatch) {
      return NextResponse.json(
        { error: "Cookie 无效，请重新登录" },
        { status: 401 }
      );
    }

    // 调用网易云 API 获取用户歌单
    const { getMusicConfig } = await import("@/app/lib/music");
    const config = getMusicConfig();
    const cookieParam = cookie ? `&cookie=${encodeURIComponent(cookie)}` : "";

    // 先获取用户信息
    const statusRes = await fetch(`${config.apiUrl}/login/status?cookie=${encodeURIComponent(cookie)}`);
    const statusData = await statusRes.json();
    const userId = statusData?.data?.account?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "无法获取用户信息" },
        { status: 401 }
      );
    }

    // 获取用户歌单
    const res = await fetch(
      `${config.apiUrl}/user/playlist?uid=${userId}&limit=100${cookieParam}`
    );
    const data = await res.json();

    if (!data.playlist) {
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

    const playlists = data.playlist.map(
      (p: { id: number; name: string; trackCount: number; coverImgUrl: string; creator?: { nickname: string } }) => ({
        playlistId: p.id,
        name: p.name,
        trackCount: p.trackCount,
        coverUrl: p.coverImgUrl,
        creator: p.creator?.nickname || "",
        imported: importedIds.has(p.id.toString()),
        isMine: p.creator?.nickname === statusData?.data?.profile?.nickname,
      })
    );

    return NextResponse.json({ playlists });
  } catch (error) {
    console.error("Get netease playlists error:", error);
    return NextResponse.json(
      { error: "获取歌单列表失败" },
      { status: 500 }
    );
  }
}
