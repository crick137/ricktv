/**
 * 续看智能排序：快看完优先 · 弃坑沉底 · 近几天加权
 */

import type { PlayRecord } from '@/lib/db.client';
import { progressPercent } from '@/lib/playProgress';

type Row = PlayRecord & { key: string };

export function sortContinueWatching(rows: Row[]): Row[] {
  const now = Date.now();
  const DAY = 86400000;

  return [...rows].sort((a, b) => {
    const score = (r: Row) => {
      const pct = progressPercent(r.play_time, r.total_time);
      const epPct =
        r.total_episodes > 1
          ? (r.index / r.total_episodes) * 100
          : pct;
      const progress = Math.max(pct, epPct);

      // 快看完（≥70%）加权；刚开头（<8%）略降
      let s = 0;
      if (progress >= 70 && progress < 98) s += 40;
      else if (progress >= 40) s += 20;
      else if (progress < 8) s -= 15;

      // 看完沉底
      if (progress >= 98 || (r.total_episodes > 1 && r.index >= r.total_episodes)) {
        s -= 80;
      }

      // 近 3 天强加权，超 21 天弃坑沉底
      const age = now - (r.save_time || 0);
      if (age < 3 * DAY) s += 35;
      else if (age < 7 * DAY) s += 15;
      else if (age > 21 * DAY) s -= 25;

      // 同分用时间
      s += Math.min(10, (r.save_time || 0) / 1e12);
      return s;
    };

    const d = score(b) - score(a);
    if (Math.abs(d) > 0.01) return d;
    return (b.save_time || 0) - (a.save_time || 0);
  });
}
