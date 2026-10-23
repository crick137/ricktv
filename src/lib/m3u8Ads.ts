/**
 * 粗粒度去广告：去掉含 #EXT-X-DISCONTINUITY 的行（与原播放页逻辑一致）。
 * 个别源若依赖 discontinuity 做码率切换，可在播放页关闭去广告。
 */
export function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';
  return m3u8Content
    .split('\n')
    .filter((line) => !line.includes('#EXT-X-DISCONTINUITY'))
    .join('\n');
}

/** 统计被去掉的 discontinuity 段数（约等于广告切入点） */
export function countM3U8AdCuts(m3u8Content: string): number {
  if (!m3u8Content) return 0;
  let n = 0;
  for (const line of m3u8Content.split('\n')) {
    if (line.includes('#EXT-X-DISCONTINUITY')) n += 1;
  }
  return n;
}
