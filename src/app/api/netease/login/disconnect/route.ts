import { NextResponse } from "next/server";
import { deleteCookie } from "@/app/lib/ncm-auth";

export async function POST() {
  try {
    await deleteCookie();
    const response = NextResponse.json({ success: true });
    response.cookies.delete("nc_netease_session");
    return response;
  } catch (error) {
    console.error("[Disconnect] 错误:", error);
    return NextResponse.json(
      { error: "断开连接失败" },
      { status: 500 }
    );
  }
}
