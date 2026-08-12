import { NextResponse } from "next/server";
import { deleteTokenFile, clearTokenCache } from "@/app/lib/netease-token";

export async function POST() {
  try {
    // 清除 token 文件和缓存
    await deleteTokenFile();
    clearTokenCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: "断开连接失败" },
      { status: 500 }
    );
  }
}
