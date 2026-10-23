import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { DOUBAN_KIND_TAGS, type DoubanKind } from '@/lib/navCategories';
import { DoubanItem, DoubanResult } from '@/lib/types';

interface DoubanApiResponse {
  subjects: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
  }>;
}

interface DoubanNewSearchResponse {
  data?: Array<{
    id: string;
    title: string;
    cover: string;
    rate: string;
  }>;
}

const DOUBAN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://movie.douban.com/',
  Accept: 'application/json, text/plain, */*',
};

async function fetchDoubanJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: DOUBAN_HEADERS,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function jsonList(list: DoubanItem[]) {
  const response: DoubanResult = {
    code: 200,
    message: '获取成功',
    list,
  };
  const cacheTime = getCacheTime();
  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, max-age=${cacheTime}`,
    },
  });
}

/** 多维筛选：tags × genres × countries（LibreTV / 豆瓣新接口） */
async function handleNewSearch(params: {
  kind: DoubanKind;
  genres: string;
  countries: string;
  sort: string;
  start: number;
}) {
  const tags = DOUBAN_KIND_TAGS[params.kind];
  if (!tags) {
    return NextResponse.json({ error: '无效 kind' }, { status: 400 });
  }

  const sort =
    params.sort === 'R' || params.sort === 'S' || params.sort === 'T'
      ? params.sort
      : 'T';

  const qs = new URLSearchParams();
  qs.set('tags', tags);
  if (params.genres) qs.set('genres', params.genres);
  if (params.countries) qs.set('countries', params.countries);
  qs.set('sort', sort);
  qs.set('range', '0,10');
  qs.set('start', String(Math.max(0, params.start)));

  const target = `https://movie.douban.com/j/new_search_subjects?${qs.toString()}`;

  try {
    const data = await fetchDoubanJson<DoubanNewSearchResponse>(target);
    const list: DoubanItem[] = (data.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: (item.cover || '').replace(/^http:/, 'https:'),
      rate: item.rate || '',
    }));
    return jsonList(list);
  } catch (error) {
    return NextResponse.json(
      { error: '获取豆瓣数据失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const kind = searchParams.get('kind') as DoubanKind | null;
  if (kind && kind in DOUBAN_KIND_TAGS) {
    return handleNewSearch({
      kind,
      genres: searchParams.get('genres') || '',
      countries: searchParams.get('countries') || '',
      sort: searchParams.get('sort') || 'T',
      start: parseInt(searchParams.get('start') || '0', 10) || 0,
    });
  }

  // —— 兼容旧接口 type + tag ——
  const type = searchParams.get('type');
  const tag = searchParams.get('tag');
  const pageSize = parseInt(searchParams.get('pageSize') || '16');
  const pageStart = parseInt(searchParams.get('pageStart') || '0');

  if (!type || !tag) {
    return NextResponse.json(
      { error: '缺少必要参数: kind 或 type+tag' },
      { status: 400 }
    );
  }

  if (!['tv', 'movie'].includes(type)) {
    return NextResponse.json(
      { error: 'type 参数必须是 tv 或 movie' },
      { status: 400 }
    );
  }

  if (pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: 'pageSize 必须在 1-100 之间' },
      { status: 400 }
    );
  }

  if (pageStart < 0) {
    return NextResponse.json(
      { error: 'pageStart 不能小于 0' },
      { status: 400 }
    );
  }

  if (tag === 'top250') {
    return handleTop250(pageStart);
  }

  // 地区/片单类用 recommend；题材类用 rank 才能铺满
  const recommendTags = new Set([
    '热门',
    '最新',
    '豆瓣高分',
    '冷门佳片',
    '华语',
    '欧美',
    '韩国',
    '日本',
  ]);
  const sort = recommendTags.has(tag) ? 'recommend' : 'rank';
  const target = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${encodeURIComponent(
    tag
  )}&sort=${sort}&page_limit=${pageSize}&page_start=${pageStart}`;

  try {
    const doubanData = await fetchDoubanJson<DoubanApiResponse>(target);

    let list: DoubanItem[] = (doubanData.subjects || []).map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover,
      rate: item.rate,
    }));

    if (list.length < Math.min(8, pageSize) && sort === 'recommend') {
      const fallback = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${encodeURIComponent(
        tag
      )}&sort=rank&page_limit=${pageSize}&page_start=${pageStart}`;
      try {
        const more = await fetchDoubanJson<DoubanApiResponse>(fallback);
        list = (more.subjects || []).map((item) => ({
          id: item.id,
          title: item.title,
          poster: item.cover,
          rate: item.rate,
        }));
      } catch {
        /* keep sparse list */
      }
    }

    return jsonList(list);
  } catch (error) {
    return NextResponse.json(
      { error: '获取豆瓣数据失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function handleTop250(pageStart: number) {
  const target = `https://movie.douban.com/top250?start=${pageStart}&filter=`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  return fetch(target, {
    signal: controller.signal,
    headers: {
      ...DOUBAN_HEADERS,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  })
    .then(async (fetchResponse) => {
      clearTimeout(timeoutId);

      if (!fetchResponse.ok) {
        throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
      }

      const html = await fetchResponse.text();
      const moviePattern =
        /<div class="item">[\s\S]*?<a[^>]+href="https?:\/\/movie\.douban\.com\/subject\/(\d+)\/"[\s\S]*?<img[^>]+alt="([^"]+)"[^>]*src="([^"]+)"[\s\S]*?<span class="rating_num"[^>]*>([^<]*)<\/span>[\s\S]*?<\/div>/g;
      const movies: DoubanItem[] = [];
      let match;

      while ((match = moviePattern.exec(html)) !== null) {
        movies.push({
          id: match[1],
          title: match[2],
          poster: match[3].replace(/^http:/, 'https:'),
          rate: match[4] || '',
        });
      }

      return jsonList(movies);
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error: '获取豆瓣 Top250 数据失败',
          details: (error as Error).message,
        },
        { status: 500 }
      );
    });
}
