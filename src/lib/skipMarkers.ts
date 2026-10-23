/**
 * 片头/片尾跳过标记（按剧名记忆，LibreTV 同款语义简化版）
 */

const STORAGE_KEY = 'ricktv1-skip-markers';

export type SkipMarker = {
  /** 片头结束秒数；到达后跳到此处 */
  introEnd: number;
  /** 片尾开始秒数；到达后视为本集结束（可选） */
  outroStart?: number;
  updatedAt: number;
};

type MarkerMap = Record<string, SkipMarker>;

export function normalizeTitleKey(title: string): string {
  return (title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[：:·\-_|【】[\]]/g, '');
}

function readAll(): MarkerMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MarkerMap;
  } catch {
    return {};
  }
}

function writeAll(map: MarkerMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getSkipMarker(title: string): SkipMarker | null {
  const key = normalizeTitleKey(title);
  if (!key) return null;
  return readAll()[key] || null;
}

export function setIntroEnd(title: string, introEnd: number) {
  const key = normalizeTitleKey(title);
  if (!key || introEnd < 5) return;
  const map = readAll();
  const prev = map[key];
  map[key] = {
    introEnd: Math.round(introEnd),
    outroStart: prev?.outroStart,
    updatedAt: Date.now(),
  };
  writeAll(map);
}

export function setOutroStart(title: string, outroStart: number) {
  const key = normalizeTitleKey(title);
  if (!key || outroStart < 30) return;
  const map = readAll();
  const prev = map[key] || { introEnd: 90, updatedAt: Date.now() };
  map[key] = {
    ...prev,
    outroStart: Math.round(outroStart),
    updatedAt: Date.now(),
  };
  writeAll(map);
}

export function clearSkipMarker(title: string) {
  const key = normalizeTitleKey(title);
  if (!key) return;
  const map = readAll();
  delete map[key];
  writeAll(map);
}

export function getAllSkipMarkers(): MarkerMap {
  return readAll();
}

export function clearAllSkipMarkers() {
  writeAll({});
}

/** 导入备份用：整表覆盖 */
export function replaceAllSkipMarkers(map: MarkerMap) {
  if (!map || typeof map !== 'object') {
    writeAll({});
    return;
  }
  writeAll(map);
}

/** 默认片头：有记忆用记忆，否则 90s */
export function resolveIntroEnd(title: string, fallback = 90): number {
  return getSkipMarker(title)?.introEnd ?? fallback;
}
