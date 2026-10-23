/**
 * 可播置信度：绿=近期真播过，黄=有源但未验证，灰=源少/曾失败
 */

import { getSourceHealth, isSourceSuspended } from '@/lib/sourceHealth';

const STORAGE_KEY = 'ricktv1-play-ok';

type OkMap = Record<string, { at: number; ms?: number }>;

function read(): OkMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OkMap) : {};
  } catch {
    return {};
  }
}

function write(map: OkMap) {
  try {
    const entries = Object.entries(map)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 400);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota */
  }
}

function sourceKey(source: string, id: string) {
  return `${source}+${id}`;
}

/** 真正开始播成功时调用（onCanPlay） */
export function recordPlayOk(source: string, id: string, ms?: number) {
  if (!source || !id) return;
  const map = read();
  map[sourceKey(source, id)] = { at: Date.now(), ms };
  write(map);
}

export function getPlayOkAt(source: string, id: string): number | null {
  return read()[sourceKey(source, id)]?.at ?? null;
}

export type ConfidenceLevel = 'green' | 'yellow' | 'gray';

export type ConfidenceInfo = {
  level: ConfidenceLevel;
  label: string;
  tone: string;
  /** 0–100 展示用 */
  score: number;
};

/**
 * 对一组同源条目估置信度
 */
export function confidenceForSources(
  items: { source: string; id: string; episodes?: string[] }[]
): ConfidenceInfo {
  if (!items.length) {
    return {
      level: 'gray',
      label: '暂无源',
      tone: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
      score: 0,
    };
  }

  const active = items.filter((i) => !isSourceSuspended(i.source));
  const now = Date.now();
  const DAY = 86400000;
  let verified = 0;
  let recentFail = 0;

  for (const it of active) {
    const okAt = getPlayOkAt(it.source, it.id);
    if (okAt && now - okAt < 7 * DAY) verified += 1;
    const h = getSourceHealth(it.source);
    if (h.lastFailAt && (!h.lastOkAt || h.lastFailAt > h.lastOkAt)) {
      if (now - h.lastFailAt < 2 * DAY) recentFail += 1;
    }
  }

  const n = active.length;
  if (verified >= 1 && n >= 1) {
    return {
      level: 'green',
      label: `${n} 源 · 可信`,
      tone: 'text-teal-200 border-teal-400/45 bg-teal-500/20',
      score: Math.min(100, 70 + verified * 10 + Math.min(n, 3) * 5),
    };
  }
  if (n >= 2 && recentFail < n) {
    return {
      level: 'yellow',
      label: `${n} 源可试`,
      tone: 'text-amber-200 border-amber-400/40 bg-amber-500/15',
      score: 45 + Math.min(n, 4) * 8,
    };
  }
  if (n === 1 && recentFail === 0) {
    return {
      level: 'yellow',
      label: '1 源可试',
      tone: 'text-amber-200 border-amber-400/40 bg-amber-500/15',
      score: 40,
    };
  }
  return {
    level: 'gray',
    label: n ? `${n} 源不稳` : '源不可用',
    tone: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
    score: Math.max(5, n * 10),
  };
}
