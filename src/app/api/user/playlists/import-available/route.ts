import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { readFileSync } from "fs";
import { resolve } from "path";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

const userId = "default-user";

// 获取可导入的歌单列表（从导出文件读取）
export async function GET(request: NextRequest) {
  // 检查登录状态
  const fallbackCookie = request.cookies.get("nc_netease_session")?.value;
  if (!(await isUserLoggedIn(fallbackCookie))) {
    return getUnauthorizedResponse();
  }

  try {
    const exportPath = resolve(
      process.cwd(),
      "docs/playlists-export.json"
    );
    const exportData = JSON.parse(readFileSync(exportPath, "utf-8"));

    // 查询已导入的歌单 neteaseId
    const imported = await prisma.playlist.findMany({
      where: { userId, neteaseId: { not: null } },
      select: { neteaseId: true },
    });
    const importedIds = new Set(
      imported.map((p) => p.neteaseId).filter(Boolean)
    );

    const playlists = exportData.playlists.map(
      (p: { playlistId: number; name: string; tracks: unknown[] }) => ({
        playlistId: p.playlistId,
        name: p.name,
        trackCount: p.tracks.length,
        imported: importedIds.has(p.playlistId.toString()),
      })
    );

    return NextResponse.json({ playlists });
  } catch (error) {
    console.error("Get importable playlists error:", error);
    return NextResponse.json(
      { error: "Failed to get importable playlists" },
      { status: 500 }
    );
  }
}
