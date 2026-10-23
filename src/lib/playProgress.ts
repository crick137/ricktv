/** 续播文案：看到 12:30 · 第 3 集 */

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatResumeLabel(opts: {
  playTime: number;
  totalTime?: number;
  episodeIndex?: number;
  totalEpisodes?: number;
}): string {
  const { playTime, episodeIndex, totalEpisodes } = opts;
  const time = formatClock(playTime);
  const multi = (totalEpisodes || 0) > 1 && (episodeIndex || 0) >= 1;
  if (multi) return `看到 ${time} · 第 ${episodeIndex} 集`;
  if (playTime > 0) return `看到 ${time}`;
  return '';
}

export function progressPercent(playTime: number, totalTime: number): number {
  if (!totalTime || totalTime <= 0) return 0;
  return Math.min(100, Math.max(0, (playTime / totalTime) * 100));
}
