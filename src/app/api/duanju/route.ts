import { NextResponse } from 'next/server';

import { API_CONFIG, getApiSites, getCacheTime } from '@/lib/config';
import {
  catalogsForGenre,
  parseDuanjuGenre,
  type DuanjuSort,
} from '@/lib/duanjuCatalog';
import { resolvePosterUrl } from '@/lib/posterUrl';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

export const runtime = 'edge';

type VodRow = {
  vod_id: string | number;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
  vod_hits?: number | string;
  vod_hits_day?: number | string;
  vod_hits_week?: number | string;
  vod_hits_month?: number | string;
  vod_score?: string;
  vod_time?: string;
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v || '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(
  siteKey: string,
  siteName: string,
  base: string,
  item: VodRow
): SearchResult & { hotScore: number; updatedAt: number } {
  let episodes: string[] = [];
  if (item.vod_play_url) {
    const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    for (const url of item.vod_play_url.split('$$$')) {
      const matches = url.match(m3u8Regex) || [];
      if (matches.length > episodes.length) episodes = matches;
    }
  }
  episodes = Array.from(new Set(episodes)).map((link: string) => {
    link = link.substring(1);
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });

  const hotScore =
    num(item.vod_hits_week) * 3 +
    num(item.vod_hits_day) * 5 +
    num(item.vod_hits) +
    Math.round((parseFloat(item.vod_score || '0') || 0) * 10);

  const updatedAt = item.vod_time
    ? Date.parse(item.vod_time.replace(/-/g, '/')) || 0
    : 0;

  return {
    id: String(item.vod_id),
    title: item.vod_name,
    poster: resolvePosterUrl(item.vod_pic, base),
    episodes,
    source: siteKey,
    source_name: siteName,
    class: item.vod_class,
    year: item.vod_year ? item.vod_year.match(/\d{4}/)?.[0] || '' : '',
    desc: cleanHtmlTags(item.vod_content || ''),
    type_name: item.type_name,
    douban_id: item.vod_douban_id,
    hotScore,
    updatedAt,
  };
}

async function fetchCatalog(
  siteKey: string,
  typeId: number,
  pages: number
): Promise<(SearchResult & { hotScore: number; updatedAt: number })[]> {
  const site = getApiSites().find((s) => s.key === siteKey);
  if (!site) return [];

  const out: (SearchResult & { hotScore: number; updatedAt: number })[] = [];
  const baseHint = site.detail || site.api;

  for (let pg = 1; pg <= pages; pg++) {
    const url = `${site.api}?ac=videolist&t=${typeId}&pg=${pg}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, {
        headers: API_CONFIG.search.headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) break;
      const data = await res.json();
      const list = (data?.list || []) as VodRow[];
      if (!list.length) break;
      for (const row of list) {
        out.push(mapRow(site.key, site.name, baseHint, row));
      }
    } catch {
      break;
    }
  }
  return out;
}

/**
 * GET /api/duanju?sort=hot|new&genre=urban&pages=2
 * 按 CMS 子分类拉短剧，再按热度 / 更新时间排序
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = (searchParams.get('sort') || 'hot') as DuanjuSort;
  const genre = parseDuanjuGenre(searchParams.get('genre'));
  const pages = Math.min(3, Math.max(1, Number(searchParams.get('pages')) || 2));

  const catalogs = catalogsForGenre(genre);
  const batches = await Promise.all(
    catalogs.map((c) => fetchCatalog(c.key, c.typeId, pages))
  );

  const byTitle = new Map<
    string,
    SearchResult & { hotScore: number; updatedAt: number }
  >();
  for (const row of batches.flat()) {
    const key = (row.title || '')
      .toLowerCase()
      .replace(/[\s·・：:（）()【】[\]]+/g, '');
    if (!key) continue;
    const prev = byTitle.get(key);
    if (!prev || row.hotScore > prev.hotScore) {
      byTitle.set(key, row);
    }
  }

  let list = Array.from(byTitle.values());
  if (sort === 'new') {
    list.sort((a, b) => b.updatedAt - a.updatedAt || b.hotScore - a.hotScore);
  } else {
    list.sort((a, b) => b.hotScore - a.hotScore || b.updatedAt - a.updatedAt);
  }

  list = list.slice(0, 60);

  const results: SearchResult[] = list.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ hotScore: _h, updatedAt: _u, ...rest }) => rest
  );

  const cacheTime = getCacheTime();
  return NextResponse.json(
    { results, sort, genre, count: results.length },
    {
      headers: {
        'Cache-Control': `public, max-age=${Math.min(cacheTime, 600)}`,
      },
    }
  );
}
