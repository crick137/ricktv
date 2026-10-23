/** 按剧名记住偏好源，下次优先用 */

const STORAGE_KEY = 'ricktv1-source-pref';

type PrefMap = Record<string, { source: string; updatedAt: number }>;

function normTitle(title: string) {
  return (title || '').trim().toLowerCase().replace(/\s+/g, '');
}

function readAll(): PrefMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PrefMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: PrefMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getPreferredSource(title: string): string | null {
  const key = normTitle(title);
  if (!key) return null;
  return readAll()[key]?.source || null;
}

export function setPreferredSource(title: string, source: string) {
  const key = normTitle(title);
  if (!key || !source) return;
  const map = readAll();
  map[key] = { source, updatedAt: Date.now() };
  writeAll(map);
}

export function clearPreferredSource(title: string) {
  const key = normTitle(title);
  if (!key) return;
  const map = readAll();
  delete map[key];
  writeAll(map);
}

export function getAllSourcePrefs(): PrefMap {
  return readAll();
}

export function replaceAllSourcePrefs(map: PrefMap) {
  if (!map || typeof map !== 'object') {
    writeAll({});
    return;
  }
  writeAll(map);
}
