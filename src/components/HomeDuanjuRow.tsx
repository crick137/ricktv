'use client';

import { useEffect, useState } from 'react';

import { getAllPlayRecords } from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import ScrollableRow from '@/components/ScrollableRow';
import SectionHeader from '@/components/SectionHeader';
import VideoCard from '@/components/VideoCard';

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\s·・：:（）()【】[\]]+/g, '')
    .trim();
}

/** 首页短剧热度行：已看的沉底并打角标 */
export default function HomeDuanjuRow() {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [seen, setSeen] = useState<Map<string, { ep: number; total: number }>>(
    new Map()
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, plays] = await Promise.all([
          fetch('/api/duanju?sort=hot&pages=1', { cache: 'no-store' }),
          getAllPlayRecords(),
        ]);
        const map = new Map<string, { ep: number; total: number }>();
        Object.values(plays).forEach((p) => {
          map.set(norm(p.title), {
            ep: p.index,
            total: p.total_episodes || 0,
          });
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: SearchResult[] = Array.isArray(data.results)
          ? data.results
          : [];
        // 未看的靠前
        list.sort((a, b) => {
          const sa = map.has(norm(a.title)) ? 1 : 0;
          const sb = map.has(norm(b.title)) ? 1 : 0;
          return sa - sb;
        });
        if (!cancelled) {
          setSeen(map);
          setItems(list.slice(0, 16));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className='mb-8 animate-slide-up'>
      <SectionHeader title='短剧热播' href='/duanju' hrefLabel='更多短剧' />
      <ScrollableRow>
        {items.map((item) => {
          const prog = seen.get(norm(item.title));
          const done =
            prog &&
            prog.total > 0 &&
            prog.ep >= prog.total &&
            prog.total === (item.episodes?.length || prog.total);
          return (
            <div
              key={`${item.source}-${item.id}`}
              className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44 relative'
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
                currentEpisode={prog?.ep}
                progress={
                  prog && prog.total > 0
                    ? Math.min(100, (prog.ep / prog.total) * 100)
                    : undefined
                }
              />
              {done && (
                <span className='absolute top-1 left-1 z-10 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[10px] text-teal-200 border border-teal-500/30'>
                  已看完
                </span>
              )}
              {prog && !done && (
                <span className='absolute top-1 left-1 z-10 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[10px] text-amber-200 border border-amber-500/30'>
                  看到第 {prog.ep} 集
                </span>
              )}
            </div>
          );
        })}
      </ScrollableRow>
    </section>
  );
}
