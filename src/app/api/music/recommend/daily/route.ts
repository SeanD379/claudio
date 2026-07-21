import { NextResponse } from "next/server";
import { getMusicConfig, getDailyRecommendations } from "@/app/lib/music";
import { isUserLoggedIn, getUnauthorizedResponse } from "@/app/lib/auth";

export async function GET() {
  // 检查登录状态
  if (!isUserLoggedIn()) {
    return getUnauthorizedResponse();
  }

  try {
    const config = getMusicConfig();
    const songs = await getDailyRecommendations(config);
    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Daily recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily recommendations" },
      { status: 500 }
    );
  }
}
