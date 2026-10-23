/**
 * 内容卫生：默认过滤擦边/低质标题；用户可「少推这类」
 */

const MUTE_KEY = 'ricktv1-muted-keywords';

const DEFAULT_BLOCK = [
  '伦理',
  '情色',
  '三级',
  '写真',
  '福利',
  '无码',
  '有码',
  '里番',
  '成人',
  'AV',
  '黄片',
  '色情',
  'SM',
  '乱伦',
  '强上',
  '迷奸',
  '换妻',
  '出轨',
];

function norm(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

function readMuted(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeMuted(list: string[]) {
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {
    /* quota */
  }
}

export function getMutedKeywords(): string[] {
  return readMuted();
}

export function muteKeyword(word: string) {
  const w = norm(word).slice(0, 24);
  if (!w || w.length < 2) return;
  const list = readMuted().filter((x) => x !== w);
  list.unshift(w);
  writeMuted(list);
}

/** 从标题抽一个可 mute 的短词（去掉季数噪声） */
export function keywordFromTitle(title: string): string {
  return (title || '')
    .replace(/第[一二三四五六七八九十\d]+[季部集].*$/, '')
    .replace(/season\s*\d+.*$/i, '')
    .trim()
    .slice(0, 12);
}

export function unmuteKeyword(word: string) {
  writeMuted(readMuted().filter((x) => x !== norm(word)));
}

export function clearMutedKeywords() {
  writeMuted([]);
}

export function isHygieneBlocked(title: string, extra?: string): boolean {
  const text = norm(`${title} ${extra || ''}`);
  if (!text) return false;
  for (const w of DEFAULT_BLOCK) {
    if (text.includes(norm(w))) return true;
  }
  for (const w of readMuted()) {
    if (w && text.includes(w)) return true;
  }
  return false;
}

export function filterHygiene<T extends { title: string; type_name?: string; class?: string; desc?: string }>(
  list: T[]
): T[] {
  return list.filter(
    (item) =>
      !isHygieneBlocked(
        item.title,
        `${item.type_name || ''} ${item.class || ''} ${item.desc || ''}`
      )
  );
}
