'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { getAllPlayRecords, type PlayRecord } from '@/lib/db.client';
import { filterHygiene } from '@/lib/contentHygiene';
import {
  DUANJU_GENRE_TABS,
  type DuanjuGenre,
  type DuanjuSort,
} from '@/lib/duanjuCatalog';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

const SORT_TABS: { id: DuanjuSort; label: string }[] = [
  { id: 'hot', label: '热播' },
  { id: 'new', label: '最新' },
];

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\s·・：:（）()【】[\]]+/g, '')
    .trim();
}

function DuanjuClient() {
  const [sort, setSort] = useState<DuanjuSort>('hot');
  const [genre, setGenre] = useState<DuanjuGenre>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideSeen, setHideSeen] = useState(true);
  const [plays, setPlays] = useState<Record<string, PlayRecord>>({});

  const load = useCallback(async (mode: DuanjuSort, g: DuanjuGenre) => {
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const [res, playMap] = await Promise.all([
        fetch(`/api/duanju?sort=${mode}&genre=${g}&pages=2`, {
          cache: 'no-store',
        }),
        getAllPlayRecords(),
      ]);
      setPlays(playMap);
      if (!res.ok) throw new Error(`加载失败 (${res.status})`);
      const data = await res.json();
      const list: SearchResult[] = Array.isArray(data.results)
        ? data.results
        : [];
      setResults(filterHygiene(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(sort, genre);
  }, [sort, genre, load]);

  const seenByTitle = useMemo(() => {
    const map = new Map<string, PlayRecord>();
    Object.values(plays).forEach((p) => map.set(norm(p.title), p));
    return map;
  }, [plays]);

  const visible = useMemo(() => {
    if (!hideSeen) return results;
    return results.filter((item) => {
      const p = seenByTitle.get(norm(item.title));
      if (!p) return true;
      const total = Math.max(p.total_episodes || 0, item.episodes?.length || 0);
      return !(total > 0 && p.index >= total);
    });
  }, [results, hideSeen, seenByTitle]);

  const genreLabel =
    DUANJU_GENRE_TABS.find((t) => t.id === genre)?.label || '全部';

  return (
    <PageLayout activePath='/duanju'>
      <div className='px-4 sm:px-10 py-6 sm:py-8 max-w-6xl mx-auto'>
        <p className='rt-eyebrow mb-2'>short drama</p>
        <h1 className='font-display text-[1.85rem] sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2'>
          短剧
        </h1>
        <p className='text-sm text-slate-500 dark:text-slate-400 mb-7 leading-relaxed max-w-xl'>
          CMS 题材分类 + 热度排序，默认隐藏已看完。
        </p>

        <div className='flex flex-wrap items-center gap-3 mb-4'>
          <div className='inline-flex rt-glass rounded-2xl p-1'>
            {SORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type='button'
                onClick={() => setSort(tab.id)}
                className={`min-w-[4.5rem] px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                  sort === tab.id
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type='button'
            onClick={() => setHideSeen((v) => !v)}
            className={`text-sm px-3 py-2 rounded-xl border transition-colors ${
              hideSeen
                ? 'border-teal-500/50 text-teal-700 dark:text-teal-300 bg-teal-500/10'
                : 'border-slate-300 dark:border-slate-600 text-slate-500'
            }`}
          >
            {hideSeen ? '已隐藏看完' : '显示全部'}
          </button>
        </div>

        <div className='mb-6 flex flex-wrap gap-1.5'>
          {DUANJU_GENRE_TABS.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setGenre(tab.id)}
              className={`text-xs sm:text-sm px-3 py-1.5 rounded-full border transition-colors ${
                genre === tab.id
                  ? 'border-teal-500 bg-teal-500/15 text-teal-800 dark:text-teal-200 font-medium'
                  : 'border-slate-300/70 dark:border-slate-600 text-slate-500 hover:border-teal-400/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className='mb-4 text-sm text-slate-500'>
          {loading
            ? '拉取分类中…'
            : error
              ? error
              : `共 ${visible.length} 部 · ${genreLabel} · ${
                  sort === 'hot' ? '按播放热度' : '按更新时间'
                }`}
        </div>

        {loading && results.length === 0 ? (
          <div className='flex justify-center py-20'>
            <div className='h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent' />
          </div>
        ) : (
          <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
            {visible.map((item) => {
              const p = seenByTitle.get(norm(item.title));
              const total = Math.max(
                p?.total_episodes || 0,
                item.episodes?.length || 0
              );
              const done = !!p && total > 0 && p.index >= total;
              return (
                <div
                  key={`${item.source}-${item.id}`}
                  className='w-full relative'
                >
                  <VideoCard
                    id={item.id}
                    title={item.title}
                    poster={item.poster}
                    episodes={item.episodes?.length || 1}
                    source={item.source}
                    source_name={item.source_name}
                    year={item.year}
                    from='search'
                    currentEpisode={p?.index}
                    progress={
                      p && total > 0
                        ? Math.min(100, (p.index / total) * 100)
                        : undefined
                    }
                  />
                  {done && (
                    <span className='absolute top-1 left-1 z-10 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-teal-200 border border-teal-500/30'>
                      已看完
                    </span>
                  )}
                  {p && !done && (
                    <span className='absolute top-1 left-1 z-10 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-amber-200 border border-amber-500/30'>
                      第 {p.index} 集
                    </span>
                  )}
                </div>
              );
            })}
            {!loading && !error && visible.length === 0 && (
              <div className='col-span-full text-center py-16 text-slate-500'>
                {hideSeen && results.length > 0
                  ? '这个分类里都看完了，关掉「已隐藏看完」或换个题材'
                  : '这个分类暂时没货，换一个试试'}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function DuanjuPage() {
  return (
    <Suspense>
      <DuanjuClient />
    </Suspense>
  );
}
