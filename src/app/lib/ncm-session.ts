// QR 登录返回的是多条 Set-Cookie 拼接值，不能原样放进一条浏览器 Cookie。
export function compactNcmCookie(raw: string): string {
  const pairs = new Map<string, string>();
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (/^(path|domain|expires|max-age|samesite|priority)$/i.test(name)) continue;
    pairs.set(name, part.slice(separator + 1).trim());
  }
  const cookie = [...pairs].map(([name, value]) => `${name}=${value}`).join("; ");
  // 留出 Cookie 名称及安全属性的空间，避免浏览器静默拒收。
  if (Buffer.byteLength(encodeURIComponent(cookie)) > 3800) {
    throw new Error("登录凭证过长，请重新扫码登录");
  }
  return cookie;
}
