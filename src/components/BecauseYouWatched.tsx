'use client';

import { useEffect, useState } from 'react';

import { getAllFavorites, getAllPlayRecords } from '@/lib/db.client';
import { DoubanItem, DoubanResult } from '@/lib/types';
import { getMediaKindBias, getTopTasteTypes } from '@/lib/watchTaste';

import DemoCard from '@/components/DemoCard';
import ScrollableRow from '@/components/ScrollableRow';
import SectionHeader from '@/components/SectionHeader';

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\s·・：:（）()【】[\]]+/g, '')
    .trim();
}

/** 口味类型 → 豆瓣 tag 粗映射 */
function tasteToTag(typeName: string, fallback: string): string {
  const t = typeName || '';
  if (/喜剧|搞笑/.test(t)) return '喜剧';
  if (/动作|武侠|功夫/.test(t)) return '动作';
  if (/爱情|言情|甜/.test(t)) return '爱情';
  if (/科幻|奇幻/.test(t)) return '科幻';
  if (/悬疑|推理|犯罪/.test(t)) return '悬疑';
  if (/动画|动漫/.test(t)) return '动画';
  if (/纪录片/.test(t)) return '纪录片';
  if (/国产|内地/.test(t)) return '国产剧';
  if (/美剧|欧美/.test(t)) return '美剧';
  if (/韩|日/.test(t)) return /韩/.test(t) ? '韩剧' : '日剧';
  if (/短剧/.test(t)) return '国产剧';
  return fallback;
}

/**
 * 「因为你看过 X」：最近续看 + 口味加权选豆瓣 tag，剔已看
 */
export default function BecauseYouWatched() {
  const [seedTitle, setSeedTitle] = useState('');
  const [kind, setKind] = useState<'movie' | 'tv'>('tv');
  const [tagUsed, setTagUsed] = useState('国产剧');
  const [picks, setPicks] = useState<DoubanItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [plays, favs] = await Promise.all([
        getAllPlayRecords(),
        getAllFavorites(),
      ]);
      const recent = Object.values(plays).sort(
        (a, b) => b.save_time - a.save_time
      )[0];
      if (!recent?.title) return;

      const seen = new Set<string>();
      Object.values(plays).forEach((p) => seen.add(norm(p.title)));
      Object.values(favs).forEach((f) => seen.add(norm(f.title)));

      const bias = getMediaKindBias();
      const isTv =
        bias.tv >= bias.movie
          ? (recent.total_episodes || 1) > 1 || bias.tv > 0.55
          : (recent.total_episodes || 1) > 1;
      const type: 'movie' | 'tv' = isTv ? 'tv' : 'movie';
      const fallback = isTv ? '国产剧' : '豆瓣高分';
      const topTaste = getTopTasteTypes(3)[0] || '';
      const tag = tasteToTag(topTaste, fallback);

      if (!cancelled) {
        setSeedTitle(recent.title);
        setKind(type);
        setTagUsed(tag);
      }

      try {
        const res = await fetch(
          `/api/douban?type=${type}&tag=${encodeURIComponent(tag)}`
        );
        if (!res.ok) return;
        const data: DoubanResult = await res.json();
        const list = (data.list || [])
          .filter((x) => {
            const k = norm(x.title);
            return k && !seen.has(k) && k !== norm(recent.title);
          })
          .slice(0, 12);
        if (!cancelled) setPicks(list);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!seedTitle || picks.length === 0) return null;

  return (
    <section className='mb-8 animate-slide-up'>
      <SectionHeader
        title={`因为你看过「${seedTitle.length > 10 ? `${seedTitle.slice(0, 10)}…` : seedTitle}」`}
        href={`/douban?type=${kind}&tag=${encodeURIComponent(tagUsed)}`}
      />
      <ScrollableRow>
        {picks.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className='min-w-[98px] w-[98px] sm:min-w-[128px] sm:w-[128px]'
          >
            <DemoCard
              id={item.id}
              title={item.title}
              poster={item.poster}
              rate={item.rate}
              type={kind}
            />
          </div>
        ))}
      </ScrollableRow>
    </section>
  );
}
