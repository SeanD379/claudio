// Only the verified NetEase image hosts support this thumbnail parameter.
export function coverImageUrl(src: string, size: number): string {
  try {
    const url = new URL(src);
    if (!/^p[1-4]\.music\.126\.net$/.test(url.hostname) || !/^https?:$/.test(url.protocol)) return src;
    const pixels = Math.min(640, Math.max(32, Math.round(size)));
    url.protocol = "https:";
    url.searchParams.set("param", `${pixels}y${pixels}`);
    return url.toString();
  } catch {
    return src;
  }
}
