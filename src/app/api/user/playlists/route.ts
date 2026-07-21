import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

const userId = "default-user";

// 获取用户歌单列表
export async function GET() {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      include: {
        _count: { select: { songs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      playlists: playlists.map((p) => ({
        id: p.id,
        neteaseId: p.neteaseId,
        name: p.name,
        description: p.description,
        coverUrl: p.coverUrl,
        songCount: p._count.songs,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get playlists error:", error);
    return NextResponse.json(
      { error: "Failed to get playlists" },
      { status: 500 }
    );
  }
}

// 导入歌单
export async function POST(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { source } = body;

    // 确保用户存在
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    if (source === "file") {
      // 从导出文件导入
      const { playlistIds } = body as { playlistIds: number[] };
      if (!playlistIds?.length) {
        return NextResponse.json(
          { error: "playlistIds is required" },
          { status: 400 }
        );
      }

      const exportPath = resolve(
        process.cwd(),
        "docs/playlists-export.json"
      );
      const exportData = JSON.parse(await readFile(exportPath, "utf-8"));
      const results = [];

      for (const pl of exportData.playlists) {
        if (!playlistIds.includes(pl.playlistId)) continue;

        // 检查是否已导入
        const existing = await prisma.playlist.findFirst({
          where: { userId, neteaseId: pl.playlistId.toString() },
        });
        if (existing) {
          results.push({ id: existing.id, name: pl.name, status: "skipped" });
          continue;
        }

        // 获取第一首歌的封面作为歌单封面
        let coverUrl = null;
        if (pl.tracks[0]) {
          const firstTrack = pl.tracks[0] as { id: number };
          const existingSong = await prisma.song.findUnique({
            where: { neteaseId: firstTrack.id.toString() },
            select: { coverUrl: true },
          });
          coverUrl = existingSong?.coverUrl || null;
        }

        // 创建歌单
        const playlist = await prisma.playlist.create({
          data: {
            userId,
            neteaseId: pl.playlistId.toString(),
            name: pl.name,
            coverUrl,
          },
        });

        // 批量导入歌曲
        const trackData = pl.tracks as Array<{
          id: number;
          name: string;
          artist: string;
          album: string;
        }>;

        for (const track of trackData) {
          const song = await prisma.song.upsert({
            where: { neteaseId: track.id.toString() },
            update: {
              title: track.name,
              artist: track.artist,
              album: track.album,
            },
            create: {
              neteaseId: track.id.toString(),
              title: track.name,
              artist: track.artist,
              album: track.album,
            },
          });

          await prisma.playlistSong.create({
            data: {
              playlistId: playlist.id,
              songId: song.id,
            },
          });
        }

        results.push({
          id: playlist.id,
          name: pl.name,
          status: "imported",
          trackCount: trackData.length,
        });
      }

      return NextResponse.json({ success: true, results });
    }

    if (source === "netease") {
      // 从网易云 API 导入
      const { neteasePlaylistId, name, coverUrl } = body as {
        neteasePlaylistId: string;
        name: string;
        coverUrl?: string;
      };

      if (!neteasePlaylistId) {
        return NextResponse.json(
          { error: "neteasePlaylistId is required" },
          { status: 400 }
        );
      }

      // 检查是否已导入
      const existing = await prisma.playlist.findFirst({
        where: { userId, neteaseId: neteasePlaylistId },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Playlist already imported", playlistId: existing.id },
          { status: 409 }
        );
      }

      // 调用网易云 API 获取歌单详情
      const { getMusicConfig, getPlaylistDetail } = await import(
        "@/app/lib/music"
      );
      const config = getMusicConfig();
      const detail = await getPlaylistDetail(config, neteasePlaylistId);

      if (!detail) {
        return NextResponse.json(
          { error: "Playlist not found on Netease" },
          { status: 404 }
        );
      }

      const playlist = await prisma.playlist.create({
        data: {
          userId,
          neteaseId: neteasePlaylistId,
          name: detail.playlist.name || name,
          description: detail.playlist.description,
          coverUrl: detail.playlist.coverUrl || coverUrl,
        },
      });

      // 批量导入歌曲
      for (const song of detail.songs) {
        const dbSong = await prisma.song.upsert({
          where: { neteaseId: song.neteaseId },
          update: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            coverUrl: song.coverUrl,
            duration: song.duration,
          },
          create: {
            neteaseId: song.neteaseId,
            title: song.title,
            artist: song.artist,
            album: song.album,
            coverUrl: song.coverUrl,
            duration: song.duration,
          },
        });

        await prisma.playlistSong.create({
          data: {
            playlistId: playlist.id,
            songId: dbSong.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        playlist: {
          id: playlist.id,
          name: playlist.name,
          trackCount: detail.songs.length,
        },
      });
    }

    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  } catch (error) {
    console.error("Import playlist error:", error);
    return NextResponse.json(
      { error: "Failed to import playlist" },
      { status: 500 }
    );
  }
}

// 删除歌单
export async function DELETE(request: NextRequest) {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get("playlistId");

    if (!playlistId) {
      return NextResponse.json(
        { error: "playlistId is required" },
        { status: 400 }
      );
    }

    // 验证歌单属于当前用户
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    await prisma.playlistSong.deleteMany({ where: { playlistId } });
    await prisma.playlist.delete({ where: { id: playlistId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete playlist error:", error);
    return NextResponse.json(
      { error: "Failed to delete playlist" },
      { status: 500 }
    );
  }
}

// 更新歌单封面（从网易云API获取）
export async function PATCH() {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const { getMusicConfig, getSongDetail } = await import("@/app/lib/music");
    const config = getMusicConfig();

    const playlists = await prisma.playlist.findMany({
      where: {
        userId,
        OR: [
          { coverUrl: null },
          { coverUrl: "https://p1.music.126.net/" },
        ],
      },
      include: {
        songs: {
          take: 1,
          include: { song: { select: { neteaseId: true } } },
        },
      },
    });

    let updated = 0;
    for (const pl of playlists) {
      const firstSongNeteaseId = pl.songs[0]?.song?.neteaseId;
      if (!firstSongNeteaseId) continue;

      try {
        const songDetail = await getSongDetail(config, firstSongNeteaseId);
        if (songDetail?.coverUrl) {
          await prisma.playlist.update({
            where: { id: pl.id },
            data: { coverUrl: songDetail.coverUrl },
          });
          // 同时更新歌曲封面
          await prisma.song.update({
            where: { neteaseId: firstSongNeteaseId },
            data: { coverUrl: songDetail.coverUrl },
          });
          updated++;
        }
      } catch (e) {
        console.error(`Failed to fetch cover for playlist ${pl.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error("Update playlist covers error:", error);
    return NextResponse.json(
      { error: "Failed to update covers" },
      { status: 500 }
    );
  }
}
