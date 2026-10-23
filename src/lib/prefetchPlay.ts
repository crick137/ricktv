/**
 * 播放预取：悬停/进页前提前探活 m3u8，并记住最优源
 */

const cache = new Map<
  string,
  { url: string; source?: string; id?: string; at: number; ok: boolean }
>();

const TTL = 5 * 60 * 1000;

function cacheKey(title: string, source?: string, id?: string) {
  return `${(title || '').trim()}|${source || ''}|${id || ''}`;
}

export function getPrefetch(
  title: string,
  source?: string,
  id?: string
): { url: string; ok: boolean } | null {
  const hit = cache.get(cacheKey(title, source, id));
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) {
    cache.delete(cacheKey(title, source, id));
    return null;
  }
  return { url: hit.url, ok: hit.ok };
}

/** 探活单条播放地址（经本站代理） */
export async function prefetchUrl(
  playUrl: string,
  meta?: { title?: string; source?: string; id?: string }
): Promise<boolean> {
  if (!playUrl || typeof window === 'undefined') return false;
  const key = cacheKey(meta?.title || playUrl, meta?.source, meta?.id);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.at < TTL) return existing.ok;

  try {
    const res = await fetch(
      `/api/speed?url=${encodeURIComponent(playUrl)}`,
      { cache: 'no-store' }
    );
    const data = (await res.json()) as { ok?: boolean };
    const ok = Boolean(data.ok);
    cache.set(key, {
      url: playUrl,
      source: meta?.source,
      id: meta?.id,
      at: Date.now(),
      ok,
    });
    return ok;
  } catch {
    cache.set(key, {
      url: playUrl,
      source: meta?.source,
      id: meta?.id,
      at: Date.now(),
      ok: false,
    });
    return false;
  }
}

/** 从候选里并行探前几个，返回第一个成功的 */
export async function prefetchBest(
  candidates: { url: string; source: string; id: string; title: string }[],
  limit = 3
): Promise<{ source: string; id: string; url: string } | null> {
  const slice = candidates.filter((c) => c.url).slice(0, limit);
  if (!slice.length) return null;

  const results = await Promise.all(
    slice.map(async (c) => {
      const ok = await prefetchUrl(c.url, {
        title: c.title,
        source: c.source,
        id: c.id,
      });
      return ok ? c : null;
    })
  );
  return results.find(Boolean) || null;
}
