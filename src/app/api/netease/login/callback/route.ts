import { NextRequest, NextResponse } from "next/server";
import { saveUserToken } from "@/app/lib/netease-token";
import { ncmApiPost } from "@/app/lib/netease-open-api";

/**
 * H5 OAuth 授权回调
 * 接收网易云音乐授权后的 code，换取 accessToken
 *
 * 流程：
 * 1. 网易授权完成后重定向到此路由，携带 code 和 state
 * 2. 用 code 调用接口换取 accessToken
 * 3. 保存 token，重定向回主页
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    console.log("[OAuth Callback] Received code:", code?.substring(0, 20) + "...");
    console.log("[OAuth Callback] Received state:", state);

    if (!code) {
      console.error("[OAuth Callback] No code received");
      return NextResponse.redirect(
        new URL("/?error=no_code", request.url)
      );
    }

    // 用 code 换取 accessToken
    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData) {
      console.error("[OAuth Callback] Failed to exchange code for token");
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", request.url)
      );
    }

    // 保存用户 token
    saveUserToken(
      tokenData.accessToken,
      tokenData.refreshToken,
      tokenData.expireTime
    );

    console.log("[OAuth Callback] Login success, redirecting to home");

    // 重定向回主页，带上成功标记
    return NextResponse.redirect(
      new URL("/?login=success", request.url)
    );
  } catch (error) {
    console.error("[OAuth Callback] Error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_failed", request.url)
    );
  }
}

/**
 * 用授权码换取 accessToken
 * 使用官方签名 API 客户端调用
 */
async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expireTime: number;
} | null> {
  try {
    // 使用带签名的 API 调用
    const data = await ncmApiPost<{
      accessToken: string;
      refreshToken: string;
      expireTime: number;
      unionId: string;
    }>("/openapi/music/basic/oauth2/token/get", {
      grantCode: code,
    });

    console.log("[OAuth] Token exchange success");

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expireTime: data.expireTime || 604800, // 默认7天
    };
  } catch (error) {
    console.error("[OAuth] exchangeCodeForToken error:", error);
    return null;
  }
}
