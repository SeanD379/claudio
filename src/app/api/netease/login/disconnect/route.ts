import { NextResponse } from "next/server";
import { deleteCookie } from "@/app/lib/ncm-auth";

export async function POST() {
  try {
    await deleteCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Disconnect] 错误:", error);
    return NextResponse.json(
      { error: "断开连接失败" },
      { status: 500 }
    );
  }
}
