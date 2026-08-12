import { NextRequest, NextResponse } from "next/server";

/**
 * H5 OAuth 授权登录入口
 * 重定向用户到网易云音乐授权页面
 *
 * 流程：
 * 1. 用户访问此路由
 * 2. 重定向到网易云音乐 H5 授权页
 * 3. 用户在授权页点击授权
 * 4. 网易回调 redirectUrl，带上 code 和 state
 */
export async function GET(request: NextRequest) {
  try {
    const appId = process.env.NETEASE_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "Missing NETEASE_APP_ID" }, { status: 500 });
    }

    // 获取当前域名作为回调地址基础
    const origin = request.nextUrl.origin;
    const redirectUrl = `${origin}/api/netease/login/callback`;

    // 生成随机 state（防止 CSRF）
    const state = Math.random().toString(36).substring(2, 15);

    // 构造网易云音乐 H5 授权页 URL
    const authUrl = new URL("https://music.163.com/st/platform/oauth/authorize");
    authUrl.searchParams.set("clientId", appId);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("clientType", "web");
    authUrl.searchParams.set("redirectUrl", redirectUrl);

    console.log("[OAuth] Redirecting to:", authUrl.toString());
    console.log("[OAuth] Redirect URL:", redirectUrl);
    console.log("[OAuth] State:", state);

    // 重定向到网易授权页
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("[OAuth] Error:", error);
    return NextResponse.json(
      { error: "授权登录失败" },
      { status: 500 }
    );
  }
}
