import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * 检查用户是否已登录网易云音乐
 * 通过检查 .netease-cookie 文件是否存在
 */
export function isUserLoggedIn(): boolean {
  try {
    const cookiePath = resolve(process.cwd(), ".netease-cookie");
    if (!existsSync(cookiePath)) {
      return false;
    }
    const cookie = readFileSync(cookiePath, "utf-8").trim();
    return cookie.length > 0;
  } catch {
    return false;
  }
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
