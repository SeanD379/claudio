import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/app/lib/music";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!keyword) {
      return NextResponse.json(
        { error: "Keyword is required" },
        { status: 400 }
      );
    }

    const songs = await searchSongs(keyword, limit);

    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Search songs error:", error);
    return NextResponse.json(
      { error: "Failed to search songs" },
      { status: 500 }
    );
  }
}
