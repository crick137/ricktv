/** 播放时间戳书签 */

const STORAGE_KEY = 'ricktv1-scene-bookmarks';

export type SceneBookmark = {
  id: string;
  title: string;
  t: number;
  note?: string;
  createdAt: number;
};

function normTitle(title: string) {
  return (title || '').trim().toLowerCase().replace(/\s+/g, '');
}

function readAll(): SceneBookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SceneBookmark[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SceneBookmark[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* quota */
  }
}

export function getBookmarksForTitle(title: string): SceneBookmark[] {
  const key = normTitle(title);
  return readAll()
    .filter((b) => normTitle(b.title) === key)
    .sort((a, b) => a.t - b.t);
}

export function addSceneBookmark(
  title: string,
  t: number,
  note?: string
): SceneBookmark | null {
  if (!title || t < 1) return null;
  const item: SceneBookmark = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    t: Math.round(t),
    note: note?.trim() || undefined,
    createdAt: Date.now(),
  };
  const list = readAll().filter(
    (b) => !(normTitle(b.title) === normTitle(title) && Math.abs(b.t - item.t) < 2)
  );
  list.unshift(item);
  writeAll(list);
  return item;
}

export function removeSceneBookmark(id: string) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function getAllSceneBookmarks(): SceneBookmark[] {
  return readAll();
}

export function replaceAllSceneBookmarks(list: SceneBookmark[]) {
  if (!Array.isArray(list)) {
    writeAll([]);
    return;
  }
  writeAll(
    list.filter(
      (b) =>
        b &&
        typeof b.id === 'string' &&
        typeof b.title === 'string' &&
        typeof b.t === 'number'
    )
  );
}
