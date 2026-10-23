import { NextResponse } from 'next/server';

import { API_CONFIG, ApiSite, getApiSites, getCacheTime } from '@/lib/config';
import { resolvePosterUrl } from '@/lib/posterUrl';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

export const runtime = 'edge';

const MAX_SEARCH_PAGES: number =
  Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5;

/** 单源总死线（LibreTV SEARCH_SOURCE_TIMEOUT_MS） */
const SOURCE_DEADLINE_MS = Number(process.env.SEARCH_SOURCE_TIMEOUT_MS) || 10000;

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

function mapItems(apiSite: ApiSite, list: ApiSearchItem[]): SearchResult[] {
  const apiName = apiSite.name;
  return list.map((item: ApiSearchItem) => {
    let episodes: string[] = [];

    if (item.vod_play_url) {
      const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
      const vod_play_url_array = item.vod_play_url.split('$$$');
      vod_play_url_array.forEach((url: string) => {
        const matches = url.match(m3u8Regex) || [];
        if (matches.length > episodes.length) {
          episodes = matches;
        }
      });
    }

    episodes = Array.from(new Set(episodes)).map((link: string) => {
      link = link.substring(1);
      const parenIndex = link.indexOf('(');
      return parenIndex > 0 ? link.substring(0, parenIndex) : link;
    });

    return {
      id: item.vod_id,
      title: item.vod_name,
      poster: resolvePosterUrl(
        item.vod_pic,
        apiSite.detail || apiSite.api
      ),
      episodes,
      source: apiSite.key,
      source_name: apiName,
      class: item.vod_class,
      year: item.vod_year ? item.vod_year.match(/\d{4}/)?.[0] || '' : '',
      desc: cleanHtmlTags(item.vod_content || ''),
      type_name: item.type_name,
      douban_id: item.vod_douban_id,
    };
  });
}

async function searchFromApi(
  apiSite: ApiSite,
  query: string,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  try {
    const apiBaseUrl = apiSite.api;
    const apiUrl =
      apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    const response = await fetch(apiUrl, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      return [];
    }

    const results = mapItems(apiSite, data.list);

    const pageCount = data.pagecount || 1;
    const pagesToFetch = Math.min(pageCount - 1, MAX_SEARCH_PAGES - 1);

    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl =
          apiBaseUrl +
          API_CONFIG.search.pagePath
            .replace('{query}', encodeURIComponent(query))
            .replace('{page}', page.toString());

        const pagePromise = (async () => {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(
              () => pageController.abort(),
              8000
            );
            const onPageAbort = () => pageController.abort();
            signal?.addEventListener('abort', onPageAbort);

            const pageResponse = await fetch(pageUrl, {
              headers: API_CONFIG.search.headers,
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);
            signal?.removeEventListener('abort', onPageAbort);

            if (!pageResponse.ok) return [];
            const pageData = await pageResponse.json();
            if (!pageData?.list || !Array.isArray(pageData.list)) return [];
            return mapItems(apiSite, pageData.list);
          } catch {
            return [];
          }
        })();

        additionalPagePromises.push(pagePromise);
      }

      const additionalResults = await Promise.all(additionalPagePromises);
      additionalResults.forEach((pageResults) => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      });
    }

    return results;
  } catch {
    return [];
  }
}

type SourceEvent = {
  type: 'source';
  sourceKey: string;
  sourceName: string;
  ok: boolean;
  list: SearchResult[];
  ms: number;
  timedOut?: boolean;
  error?: string;
};

async function searchOneSite(
  site: ApiSite,
  query: string
): Promise<SourceEvent> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_DEADLINE_MS);
  try {
    const list = await searchFromApi(site, query, controller.signal);
    clearTimeout(timer);
    const ms = Date.now() - started;
    const timedOut = ms >= SOURCE_DEADLINE_MS - 50;
    return {
      type: 'source',
      sourceKey: site.key,
      sourceName: site.name,
      ok: list.length > 0,
      list,
      ms,
      timedOut: timedOut && list.length === 0,
    };
  } catch (e) {
    clearTimeout(timer);
    const timedOut = controller.signal.aborted;
    return {
      type: 'source',
      sourceKey: site.key,
      sourceName: site.name,
      ok: false,
      list: [],
      ms: Date.now() - started,
      timedOut,
      error: e instanceof Error ? e.message : 'error',
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const stream = searchParams.get('stream') === '1';
  const exclude = (searchParams.get('exclude') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const include = (searchParams.get('sites') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!query) {
    const cacheTime = getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  }

  let apiSites = getApiSites();
  if (include.length) {
    const allow = new Set(include);
    apiSites = apiSites.filter((s) => allow.has(s.key));
  }
  if (exclude.length) {
    const ban = new Set(exclude);
    apiSites = apiSites.filter((s) => !ban.has(s.key));
  }

  // NDJSON 流式：每源结算即推送（LibreTV ?stream=1）
  if (stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const push = (obj: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        };
        await Promise.all(
          apiSites.map(async (site) => {
            const evt = await searchOneSite(site, query);
            push(evt);
          })
        );
        push({ type: 'done' });
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  try {
    const events = await Promise.all(
      apiSites.map((site) => searchOneSite(site, query))
    );
    const flattenedResults = events.flatMap((e) => e.list);
    const failures = events
      .filter((e) => !e.ok)
      .map((e) => ({
        sourceKey: e.sourceKey,
        timedOut: e.timedOut,
        error: e.error,
        ms: e.ms,
      }));
    const cacheTime = getCacheTime();

    return NextResponse.json(
      { results: flattenedResults, failures },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  } catch {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
