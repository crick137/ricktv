import { LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import PosterImage from '@/components/PosterImage';
import { confidenceForSources } from '@/lib/playConfidence';
import { prefetchUrl } from '@/lib/prefetchPlay';
import { isSourceSuspended } from '@/lib/sourceHealth';

// 聚合卡需要的基本字段，与搜索接口保持一致
interface SearchResult {
  id: string;
  title: string;
  poster: string;
  source: string;
  source_name: string;
  douban_id?: number;
  year?: string;
  episodes: string[];
}

interface AggregateCardProps {
  /** 同一标题下的多个搜索结果 */
  query?: string;
  year?: string;
  items: SearchResult[];
}

function PlayCircleSolid({
  className = '',
  fillColor = 'none',
}: {
  className?: string;
  fillColor?: string;
}) {
  return (
    <svg
      width='44'
      height='44'
      viewBox='0 0 44 44'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
    >
      <circle
        cx='22'
        cy='22'
        r='20'
        stroke='white'
        strokeWidth='1.5'
        fill={fillColor}
      />
      <polygon points='19,15 19,29 29,22' fill='white' />
    </svg>
  );
}

/**
 * 与 `VideoCard` 基本一致，删除了来源标签、收藏等功能
 * 点击播放按钮 -> 跳到第一个源播放
 * 点击卡片其他区域 -> 跳到聚合详情页 (/aggregate)
 */
const AggregateCard: React.FC<AggregateCardProps> = ({
  query = '',
  year = 0,
  items,
}) => {
  // 优先用未熔断源做展示 & 播放
  const liveItems = useMemo(
    () => items.filter((i) => !isSourceSuspended(i.source)),
    [items]
  );
  const first = liveItems[0] || items[0];
  const [playHover, setPlayHover] = useState(false);
  const router = useRouter();
  const confidence = useMemo(
    () => confidenceForSources(liveItems.length ? liveItems : items),
    [liveItems, items]
  );

  // 统计 items 中出现次数最多的（非 0） douban_id，用于跳转豆瓣页面
  const mostFrequentDoubanId = useMemo(() => {
    const countMap = new Map<number, number>();

    items.forEach((item) => {
      if (item.douban_id && item.douban_id !== 0) {
        countMap.set(item.douban_id, (countMap.get(item.douban_id) || 0) + 1);
      }
    });

    let selectedId: number | undefined;
    let maxCount = 0;

    countMap.forEach((cnt, id) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        selectedId = id;
      }
    });

    return selectedId;
  }, [items]);

  // 统计出现次数最多的集数（episodes.length），主要用于显示剧集数徽标
  const mostFrequentEpisodes = useMemo(() => {
    const countMap = new Map<number, number>();

    items.forEach((item) => {
      const len = item.episodes?.length || 0;
      if (len > 0) {
        countMap.set(len, (countMap.get(len) || 0) + 1);
      }
    });

    let selectedLen = 0;
    let maxCount = 0;

    countMap.forEach((cnt, len) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        selectedLen = len;
      }
    });

    return selectedLen;
  }, [items]);

  return (
    <Link
      href={`/aggregate?q=${encodeURIComponent(
        query
      )}&title=${encodeURIComponent(first.title)}${
        year ? `&year=${encodeURIComponent(year)}` : ''
      }&type=${mostFrequentEpisodes > 1 ? 'tv' : 'movie'}`}
    >
      <div className='group relative w-full rounded-lg bg-transparent flex flex-col cursor-pointer transition-all duration-300 ease-in-out'>
        <div className='relative aspect-[2/3] w-full overflow-hidden rounded-2xl rt-poster-frame group-hover:scale-[1.02] transition-all duration-500'>
          <PosterImage
            src={first.poster}
            alt={first.title}
            fill
            className='object-cover transition-transform duration-700 ease-out group-hover:scale-110'
            priority={false}
          />
          <div
            className='pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent'
            aria-hidden
          />

          <div className='absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center overflow-hidden'>
            {/* 播放按钮 */}
            <div className='absolute inset-0 flex items-center justify-center pointer-events-auto'>
              <div
                className={`transition-all duration-300 cubic-bezier(0.4,0,0.2,1) ${
                  playHover ? 'scale-100 opacity-100' : 'scale-90 opacity-70'
                }`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(
                    `/play?source=${first.source}&id=${
                      first.id
                    }&title=${encodeURIComponent(first.title)}${
                      year ? `&year=${year}` : ''
                    }&from=aggregate`
                  );
                }}
                onMouseEnter={() => {
                  setPlayHover(true);
                  const url = first.episodes?.[0];
                  if (url) {
                    void prefetchUrl(url, {
                      title: first.title,
                      source: first.source,
                      id: first.id,
                    });
                  }
                }}
                onMouseLeave={() => setPlayHover(false)}
              >
                <PlayCircleSolid fillColor={playHover ? '#14b8a6' : 'none'} />
              </div>
            </div>
          </div>

          {/* 可播置信度 */}
          {items.length > 0 && (
            <div
              className={`absolute bottom-2 left-2 z-[5] rounded-md border px-1.5 py-0.5 text-[10px] sm:text-[11px] tabular-nums shadow-md backdrop-blur-sm ${confidence.tone}`}
            >
              {confidence.label}
            </div>
          )}

          {/* 集数矩形展示框 */}
          {mostFrequentEpisodes && mostFrequentEpisodes > 1 && (
            <div className='absolute top-2 right-2 w-7 h-7 sm:w-7 sm:h-7 rounded-full bg-teal-500/90 dark:bg-teal-600/90 flex items-center justify-center shadow-md text-[0.55rem] sm:text-xs'>
              <span className='text-white font-bold leading-none'>
                {mostFrequentEpisodes}
              </span>
            </div>
          )}

          {/* 豆瓣链接按钮 */}
          {mostFrequentDoubanId && (
            <a
              href={`https://movie.douban.com/subject/${mostFrequentDoubanId}`}
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='absolute top-2 left-2 scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all duration-300 cubic-bezier(0.4,0,0.2,1)'
            >
              <div className='w-4 h-4 sm:w-7 sm:h-7 rounded-full bg-[#14b8a6] flex items-center justify-center shadow-md opacity-70 hover:opacity-100 transition-all duration-200 ease-in-out hover:scale-110 hover:bg-[#0d9488]'>
                <LinkIcon className='w-4 h-4 text-white' strokeWidth={2} />
              </div>
            </a>
          )}
        </div>

        {/* 标题 */}
        <span className='mt-2.5 px-0.5 block text-slate-900 font-medium truncate w-full text-center text-[0.7rem] sm:text-[0.8125rem] leading-snug tracking-tight dark:text-slate-100 transition-all duration-300 group-hover:-translate-y-0.5 opacity-90 group-hover:opacity-100 group-hover:text-teal-700 dark:group-hover:text-teal-300'>
          {first.title}
        </span>
      </div>
    </Link>
  );
};

export default AggregateCard;
