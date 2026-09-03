import { hasCookie } from "./ncm-auth";

/**
 * 检查用户是否已登录网易云音乐
 * 通过检查 Cookie 是否存在
 */
export async function isUserLoggedIn(fallback?: string): Promise<boolean> {
  return hasCookie(fallback);
}

/**
 * 获取登录状态的响应
 * 用于在 API 端点中统一返回未登录错误
 */
export function getUnauthorizedResponse() {
  return Response.json(
    { error: "请先登录", code: "UNAUTHORIZED" },
    { status: 401 }
  );
}
