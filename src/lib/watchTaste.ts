/**
 * 观影口味：按类型累加观看时长，供首页推荐加权
 */

const STORAGE_KEY = 'ricktv1-watch-taste';

type TasteMap = Record<string, number>; // type -> seconds

function read(): TasteMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TasteMap) : {};
  } catch {
    return {};
  }
}

function write(map: TasteMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

function normType(t: string) {
  return (t || '').trim().slice(0, 32) || '未分类';
}

export function recordTasteSeconds(typeName: string, seconds: number) {
  if (!seconds || seconds < 1 || seconds > 3600) return;
  const key = normType(typeName);
  const map = read();
  map[key] = (map[key] || 0) + seconds;
  write(map);
}

export function getTopTasteTypes(limit = 5): string[] {
  return Object.entries(read())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

export function getAllWatchTaste(): TasteMap {
  return read();
}

export function replaceAllWatchTaste(map: TasteMap) {
  if (!map || typeof map !== 'object') {
    write({});
    return;
  }
  write(map);
}

/** 电影 / 剧集偏好权重（0–1） */
export function getMediaKindBias(): { movie: number; tv: number } {
  const map = read();
  let movie = 0;
  let tv = 0;
  for (const [k, sec] of Object.entries(map)) {
    if (/电影|movie|片/i.test(k)) movie += sec;
    else if (/剧|综艺|动漫|短剧|tv/i.test(k)) tv += sec;
    else tv += sec * 0.5;
  }
  const sum = movie + tv || 1;
  return { movie: movie / sum, tv: tv / sum };
}
