'use client';

import {
  BookOpen,
  Clover,
  Film,
  FlaskConical,
  Ghost,
  Globe2,
  LayoutGrid,
  MessageCircleHeart,
  MountainSnow,
  Smartphone,
  Star,
  Swords,
  Tv,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildDiscoverApiUrl,
  DISCOVER_SECTIONS,
  type DoubanKind,
} from '@/lib/navCategories';
import type { DoubanItem, DoubanResult, SearchResult } from '@/lib/types';

import DemoCard from '@/components/DemoCard';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

const ICON_MAP: Record<string, LucideIcon> = {
  film: Film,
  tv: Tv,
  star: Star,
  clover: Clover,
  swords: Swords,
  heart: MessageCircleHeart,
  snow: MountainSnow,
  mask: VenetianMask,
  book: BookOpen,
  globe: Globe2,
  flask: FlaskConical,
  ghost: Ghost,
  phone: Smartphone,
};

const SORT_TABS: { id: 'T' | 'S' | 'R'; label: string }[] = [
  { id: 'T', label: '热度' },
  { id: 'S', label: '评分' },
  { id: 'R', label: '最新' },
];

type GridItem =
  | { kind: 'douban'; item: DoubanItem; mediaType: string }
  | { kind: 'duanju'; item: SearchResult };

function mediaTypeOf(kind: DoubanKind): string {
  return kind === 'tv' || kind === 'variety' ? 'tv' : 'movie';
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className='flex items-center gap-2 min-w-0 pt-2'>
      <span className='shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-500 w-7'>
        {label}
      </span>
      <div
        className='flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        role='tablist'
        aria-label={label}
      >
        {options.map((f) => {
          const active = f.value === value;
          return (
            <button
              key={label + f.label + f.value}
              type='button'
              role='tab'
              aria-selected={active}
              onClick={() => onChange(f.value)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] sm:text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const [sectionId, setSectionId] = useState(DISCOVER_SECTIONS[0].id);
  const [region, setRegion] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<'T' | 'S' | 'R'>('T');
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const section = useMemo(
    () =>
      DISCOVER_SECTIONS.find((s) => s.id === sectionId) ?? DISCOVER_SECTIONS[0],
    [sectionId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      if (section.mode === 'duanju') {
        const g = genre || 'all';
        const res = await fetch(
          `/api/duanju?sort=hot&genre=${encodeURIComponent(g)}&pages=2`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`加载失败 (${res.status})`);
        const data = await res.json();
        const list: SearchResult[] = Array.isArray(data.results)
          ? data.results
          : [];
        setItems(list.map((item) => ({ kind: 'duanju' as const, item })));
        return;
      }

      const kind = section.kind || 'movie';
      const url = buildDiscoverApiUrl({
        kind,
        countries: region || undefined,
        genres: genre || undefined,
        sort,
        start: 0,
      });
      const res = await fetch(url);
      if (!res.ok) throw new Error('获取豆瓣数据失败');
      const data: DoubanResult = await res.json();
      if (data.code !== 200) throw new Error(data.message || '获取失败');
      const mt = mediaTypeOf(kind);
      setItems(
        (data.list || []).map((item) => ({
          kind: 'douban' as const,
          item,
          mediaType: mt,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [section, region, genre, sort]);

  useEffect(() => {
    setRegion('');
    setGenre(section.mode === 'duanju' ? 'all' : '');
    setSort('T');
  }, [sectionId, section.mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const skeletons = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  const regionOpts = section.regions || [];
  const genreOpts = section.genres || [];

  return (
    <PageLayout activePath='/discover'>
      <div className='px-4 sm:px-10 py-5 sm:py-8 pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <div className='mb-4 flex items-end justify-between gap-3'>
          <div>
            <p className='rt-eyebrow mb-2'>discover</p>
            <h1 className='font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50'>
              发现
            </h1>
          </div>
          {section.mode === 'douban' && (
            <div className='inline-flex rt-glass rounded-xl p-0.5 shrink-0'>
              {SORT_TABS.map((t) => (
                <button
                  key={t.id}
                  type='button'
                  onClick={() => setSort(t.id)}
                  className={`px-2.5 py-1 text-[11px] sm:text-xs rounded-lg font-medium transition-colors ${
                    sort === t.id
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='sticky top-0 z-10 -mx-4 px-4 sm:-mx-10 sm:px-10 py-2 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md'>
          <div
            className='flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            role='tablist'
            aria-label='片种'
          >
            {DISCOVER_SECTIONS.map((s) => {
              const Icon = ICON_MAP[s.icon] || LayoutGrid;
              const active = s.id === sectionId;
              return (
                <button
                  key={s.id}
                  type='button'
                  role='tab'
                  aria-selected={active}
                  onClick={() => setSectionId(s.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-teal-500 text-white shadow-sm shadow-teal-900/20'
                      : 'rt-glass text-slate-600 dark:text-slate-300 hover:bg-teal-500/10'
                  }`}
                >
                  <Icon
                    className='h-3.5 w-3.5'
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>

          {regionOpts.length > 0 && (
            <ChipRow
              label='地区'
              options={regionOpts}
              value={region}
              onChange={setRegion}
            />
          )}
          {genreOpts.length > 0 && (
            <ChipRow
              label={section.mode === 'duanju' ? '题材' : '类型'}
              options={genreOpts}
              value={genre}
              onChange={setGenre}
            />
          )}
        </div>

        <div className='mt-5'>
          {error ? (
            <div className='rt-glass rounded-2xl px-5 py-8 text-center'>
              <p className='text-sm text-slate-500 mb-3'>{error}</p>
              <button
                type='button'
                onClick={() => void load()}
                className='text-sm px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-500'
              >
                重试
              </button>
            </div>
          ) : (
            <div className='grid grid-cols-3 gap-x-2 gap-y-10 sm:grid-cols-[repeat(auto-fill,_minmax(10rem,_1fr))] sm:gap-x-6 sm:gap-y-14'>
              {loading
                ? skeletons.map((i) => <DoubanCardSkeleton key={i} />)
                : items.map((row, index) =>
                    row.kind === 'douban' ? (
                      <div
                        key={`d-${row.item.id || row.item.title}-${index}`}
                        className='w-full'
                      >
                        <DemoCard
                          id={row.item.id}
                          title={row.item.title}
                          poster={row.item.poster}
                          rate={row.item.rate}
                          type={row.mediaType}
                        />
                      </div>
                    ) : (
                      <div
                        key={`j-${row.item.source}-${row.item.id}-${index}`}
                        className='w-full'
                      >
                        <VideoCard
                          id={row.item.id}
                          title={row.item.title}
                          poster={row.item.poster}
                          episodes={row.item.episodes?.length}
                          source={row.item.source}
                          source_name={row.item.source_name}
                          from='search'
                        />
                      </div>
                    )
                  )}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className='text-center text-sm text-slate-500 py-10'>暂无内容</p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
