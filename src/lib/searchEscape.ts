/**
 * 空搜逃生：缩短 / 去季数年份 / 候选提示
 */

import { normalizeTitle } from '@/lib/fuzzyTitle';
import { seriesRootTitle } from '@/lib/seriesTitle';

/** 生成递进重试查询（不含原词） */
export function buildEscapeQueries(query: string): string[] {
  const q = (query || '').trim();
  if (!q) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && t !== q && !out.includes(t) && t.length >= 1) out.push(t);
  };

  // 去掉年份
  push(q.replace(/(19|20)\d{2}/g, '').replace(/\s+/g, ' '));
  // 去掉季/部
  push(seriesRootTitle(q));
  push(
    q
      .replace(/第[一二三四五六七八九十\d]+\s*[季部集章]/g, '')
      .replace(/season\s*\d+/gi, '')
      .replace(/\bs0*\d+\b/gi, '')
      .replace(/\s+/g, ' ')
  );
  // 去掉括号备注
  push(q.replace(/[（(【[].*?[）)\]】]/g, '').replace(/\s+/g, ' '));
  // 取前半 / 去掉空格
  if (q.length > 4) push(q.slice(0, Math.ceil(q.length * 0.6)));
  if (q.length > 6) push(q.slice(0, 4));
  push(q.replace(/\s+/g, ''));

  return out.slice(0, 6);
}

/** 从已有结果里挑「你是不是要找」——标题短且出现频次高 */
export function didYouMeanTitles(
  query: string,
  titles: string[],
  limit = 4
): string[] {
  const nq = normalizeTitle(query);
  const counts = new Map<string, number>();
  for (const t of titles) {
    const clean = (t || '').trim();
    if (!clean || clean.length > 40) continue;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([t]) => normalizeTitle(t) !== nq)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, limit)
    .map(([t]) => t);
}
