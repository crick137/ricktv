'use client';

import { useEffect, useMemo, useState } from 'react';

import { getAllFavorites, getAllPlayRecords } from '@/lib/db.client';
import { isHygieneBlocked } from '@/lib/contentHygiene';
import { DoubanItem, DoubanResult } from '@/lib/types';
import { getMediaKindBias } from '@/lib/watchTaste';

import DemoCard from '@/components/DemoCard';
import ScrollableRow from '@/components/ScrollableRow';
import SectionHeader from '@/components/SectionHeader';

type Seed = DoubanItem & { kind: 'movie' | 'tv' };

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\s·・：:（）()【】[\]]+/g, '')
    .trim();
}

/**
 * 猜你想看：豆瓣热门/高分里，剔掉已续看、已收藏的标题
 * （不再把收藏夹原样再推一遍）
 */
export default function HomeRecommend({
  hotMovies = [],
  hotTvShows = [],
}: {
  hotMovies?: DoubanItem[];
  hotTvShows?: DoubanItem[];
}) {
  const [extra, setExtra] = useState<Seed[]>([]);
  const [seenTitles, setSeenTitles] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [favs, plays] = await Promise.all([
        getAllFavorites(),
        getAllPlayRecords(),
      ]);
      const titles = new Set<string>();
      Object.values(favs).forEach((f) => titles.add(norm(f.title)));
      Object.values(plays).forEach((p) => titles.add(norm(p.title)));
      setSeenTitles(titles);
      setReady(true);
    })();
  }, []);

  // 首页热门不够时，再拉豆瓣高分补货
  useEffect(() => {
    if (!ready) return;
    if (hotMovies.length + hotTvShows.length >= 12) return;
    let cancelled = false;
    (async () => {
      try {
        const [m, t] = await Promise.all([
          fetch('/api/douban?type=movie&tag=豆瓣高分'),
          fetch('/api/douban?type=tv&tag=国产剧'),
        ]);
        const seeds: Seed[] = [];
        if (m.ok) {
          const data: DoubanResult = await m.json();
          (data.list || []).forEach((x) =>
            seeds.push({ ...x, kind: 'movie' })
          );
        }
        if (t.ok) {
          const data: DoubanResult = await t.json();
          (data.list || []).forEach((x) => seeds.push({ ...x, kind: 'tv' }));
        }
        if (!cancelled) setExtra(seeds);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, hotMovies.length, hotTvShows.length]);

  const picks = useMemo(() => {
    if (!ready) return [];
    const pool: Seed[] = [
      ...hotMovies.map((x) => ({ ...x, kind: 'movie' as const })),
      ...hotTvShows.map((x) => ({ ...x, kind: 'tv' as const })),
      ...extra,
    ];

    // 去重标题 + 排除已看/已藏
    const byTitle = new Map<string, Seed>();
    for (const item of pool) {
      const key = norm(item.title);
      if (!key || seenTitles.has(key)) continue;
      if (isHygieneBlocked(item.title)) continue;
      if (!byTitle.has(key)) byTitle.set(key, item);
    }

    const list = Array.from(byTitle.values());
    const bias = getMediaKindBias();
    // 评分 × 口味权重
    list.sort((a, b) => {
      const ra =
        (parseFloat(a.rate || '0') || 0) *
        (1 + (a.kind === 'movie' ? bias.movie : bias.tv));
      const rb =
        (parseFloat(b.rate || '0') || 0) *
        (1 + (b.kind === 'movie' ? bias.movie : bias.tv));
      if (rb !== ra) return rb - ra;
      return (a.id || '').localeCompare(b.id || '');
    });

    // 按口味比例交错：更偏看剧就多塞剧
    const movies = list.filter((x) => x.kind === 'movie');
    const tvs = list.filter((x) => x.kind === 'tv');
    const mixed: Seed[] = [];
    let i = 0;
    let j = 0;
    let tick = 0;
    const preferTv = bias.tv >= bias.movie;
    while (mixed.length < 12 && (i < movies.length || j < tvs.length)) {
      const takeTv =
        preferTv
          ? tick % 3 !== 2 // 剧/剧/影
          : tick % 3 !== 0; // 影/剧/影
      if (takeTv && j < tvs.length) mixed.push(tvs[j++]);
      else if (i < movies.length) mixed.push(movies[i++]);
      else if (j < tvs.length) mixed.push(tvs[j++]);
      tick += 1;
    }
    return mixed;
  }, [ready, hotMovies, hotTvShows, extra, seenTitles]);

  if (!ready) return null;
  if (picks.length === 0) return null;

  return (
    <section className='mb-8 animate-slide-up'>
      <SectionHeader
        title='猜你想看'
        href='/douban?type=movie&tag=豆瓣高分&title=豆瓣高分'
        hrefLabel='更多高分'
      />
      <p className='-mt-2 mb-3 text-xs text-slate-500 dark:text-slate-400 px-0.5'>
        已看剔出 · 按你最近口味加权
      </p>
      <ScrollableRow>
        {picks.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
          >
            <DemoCard
              id={item.id}
              title={item.title}
              poster={item.poster}
              rate={item.rate}
              type={item.kind}
            />
          </div>
        ))}
      </ScrollableRow>
    </section>
  );
}
