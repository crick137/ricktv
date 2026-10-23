export type SpeedResult = {
  ok: boolean;
  ms: number | null;
};

/** 通过本站 /api/speed 探测源首包耗时 */
export async function probePlayUrl(playUrl: string): Promise<SpeedResult> {
  if (!playUrl) return { ok: false, ms: null };
  try {
    const res = await fetch(
      `/api/speed?url=${encodeURIComponent(playUrl)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { ok: false, ms: null };
    const data = (await res.json()) as {
      ok?: boolean;
      ms?: number | null;
    };
    return {
      ok: Boolean(data.ok),
      ms: typeof data.ms === 'number' ? data.ms : null,
    };
  } catch {
    return { ok: false, ms: null };
  }
}

/** 批量测速；concurrency 限制并行 */
export async function probeMany(
  items: { key: string; url: string }[],
  concurrency = 4
): Promise<Record<string, SpeedResult>> {
  const out: Record<string, SpeedResult> = {};
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      out[item.key] = await probePlayUrl(item.url);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return out;
}

export function formatSpeedMs(ms: number | null, ok: boolean): string {
  if (!ok || ms == null) return '超时';
  if (ms < 800) return `${ms}ms · 快`;
  if (ms < 2000) return `${ms}ms`;
  return `${ms}ms · 慢`;
}

export function speedTone(ms: number | null, ok: boolean): string {
  if (!ok || ms == null) return 'text-red-400 border-red-500/40 bg-red-500/10';
  if (ms < 800) return 'text-cyan-300 border-cyan-400/50 bg-cyan-500/15';
  if (ms < 2000) return 'text-amber-300 border-amber-400/40 bg-amber-500/10';
  return 'text-orange-300 border-orange-500/40 bg-orange-500/10';
}
