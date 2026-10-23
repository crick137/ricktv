/**
 * 设置页：一键诊断热门源延迟
 */

import { getApiSites } from '@/lib/config';
import { getAllSourceHealth, isSourceSuspended } from '@/lib/sourceHealth';

export type DiagnoseRow = {
  key: string;
  name: string;
  ok: boolean;
  ms: number | null;
  suspended: boolean;
  error?: string;
};

async function probeApi(api: string, signal: AbortSignal): Promise<number> {
  const url = `${api}?ac=list`;
  const t0 = performance.now();
  const res = await fetch(`/api/speed?url=${encodeURIComponent(url)}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const data = (await res.json()) as { ok?: boolean; ms?: number | null };
  if (!data.ok) throw new Error('probe fail');
  return typeof data.ms === 'number' ? data.ms : Math.round(performance.now() - t0);
}

/** 诊断前 N 个源（跳过长期停用可仍测） */
export async function diagnoseSources(
  limit = 6,
  onProgress?: (row: DiagnoseRow, done: number, total: number) => void
): Promise<DiagnoseRow[]> {
  const sites = getApiSites().slice(0, limit);
  const health = getAllSourceHealth();
  const rows: DiagnoseRow[] = [];
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);

  try {
    let i = 0;
    for (const site of sites) {
      i += 1;
      const suspended = isSourceSuspended(site.key);
      let row: DiagnoseRow;
      try {
        const ms = await probeApi(site.api, ac.signal);
        row = {
          key: site.key,
          name: site.name,
          ok: true,
          ms,
          suspended,
        };
      } catch (e) {
        row = {
          key: site.key,
          name: site.name,
          ok: false,
          ms: health[site.key]?.lastMs ?? null,
          suspended,
          error: e instanceof Error ? e.message : 'fail',
        };
      }
      rows.push(row);
      onProgress?.(row, i, sites.length);
    }
  } finally {
    clearTimeout(timer);
  }
  return rows;
}
