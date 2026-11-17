export class NcmPlaylistError extends Error {
  readonly status: number;

  constructor(readonly upstreamCode?: number) {
    const loginExpired = upstreamCode === 301 || upstreamCode === 401;
    super(loginExpired
      ? "网易云登录已失效，请重新扫码"
      : upstreamCode === 403
        ? "当前网易云账号无权访问该歌单"
        : "暂时无法获取网易云歌单，请稍后重试");
    this.name = "NcmPlaylistError";
    this.status = loginExpired ? 401 : upstreamCode === 403 ? 403 : 502;
  }
}
