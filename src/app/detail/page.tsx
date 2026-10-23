/* eslint-disable react-hooks/exhaustive-deps, no-console */

'use client';

import { Heart, LinkIcon } from 'lucide-react';
import PosterImage from '@/components/PosterImage';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import {
  generateStorageKey,
  getAllPlayRecords,
  isFavorited,
  toggleFavorite,
} from '@/lib/db.client';
import { type VideoDetail, fetchVideoDetail } from '@/lib/fetchVideoDetail';
import { formatClock, formatResumeLabel } from '@/lib/playProgress';
import { prefetchUrl } from '@/lib/prefetchPlay';

import PageLayout from '@/components/PageLayout';

function DetailPageClient() {
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playRecord, setPlayRecord] = useState<PlayRecord | null>(null);
  const [favorited, setFavorited] = useState(false);
  // 是否倒序显示选集
  const [reverseEpisodeOrder, setReverseEpisodeOrder] = useState(false);

  const fallbackTitle = searchParams.get('title') || '';
  const fallbackYear = searchParams.get('year') || '';

  // 格式化剩余时间（如 1h 50m）
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (parts.length === 0) parts.push('0m');
    return parts.join(' ');
  };

  useEffect(() => {
    const source = searchParams.get('source');
    const id = searchParams.get('id');

    if (!source || !id) {
      setError('缺少必要参数');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // 获取视频详情
        const detailData = await fetchVideoDetail({
          source,
          id,
          fallbackTitle,
          fallbackYear,
        });
        setDetail(detailData);

        // 获取播放记录
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(source, id);
        const record = allRecords[key] || null;
        setPlayRecord(record);

        // 预热即将播放的那一集
        const epIdx = record ? Math.max(0, record.index - 1) : 0;
        const warmUrl = detailData.episodes?.[epIdx] || detailData.episodes?.[0];
        if (warmUrl) {
          void prefetchUrl(warmUrl, {
            title: detailData.title,
            source,
            id,
          });
        }

        // 检查收藏状态
        try {
          const fav = await isFavorited(source, id);
          setFavorited(fav);
        } catch (checkErr) {
          console.error('检查收藏状态失败:', checkErr);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取详情失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  // 切换收藏状态
  const handleToggleFavorite = async () => {
    const source = searchParams.get('source');
    const id = searchParams.get('id');
    if (!source || !id || !detail) return;

    try {
      const newState = await toggleFavorite(source, id, {
        title: detail.title,
        source_name: detail.source_name,
        year: detail.year || fallbackYear || '',
        cover: detail.poster || '',
        total_episodes: detail.episodes.length || 1,
        save_time: Date.now(),
      });
      setFavorited(newState);
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  return (
    <PageLayout activePath='/detail'>
      <div className='flex flex-col min-h-full px-2 sm:px-10 pt-4 sm:pt-8 pb-[calc(3.5rem+env(safe-area-inset-bottom))] overflow-visible'>
        {/* 顶部返回按钮已移入右侧信息容器 */}
        {loading ? (
          <div className='flex items-center justify-center min-h-[60vh]'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500'></div>
          </div>
        ) : error ? (
          <div className='flex items-center justify-center min-h-[60vh]'>
            <div className='text-red-500 text-center'>
              <div className='text-lg font-semibold mb-2'>加载失败</div>
              <div className='text-sm'>{error}</div>
            </div>
          </div>
        ) : !detail ? (
          <div className='flex items-center justify-center min-h-[60vh]'>
            <div className='text-gray-500 text-center'>
              <div className='text-lg font-semibold mb-2'>未找到视频详情</div>
            </div>
          </div>
        ) : (
          <div className='max-w-[95%] mx-auto'>
            {/* 主信息区：左图右文 */}
            <div className='relative flex flex-col md:flex-row gap-8 mb-0 sm:mb-8 bg-transparent rounded-xl p-2 sm:p-6 md:items-start'>
              {/* 返回按钮放置在主信息区左上角 */}
              <button
                onClick={() => {
                  window.history.back();
                }}
                className='absolute top-0 left-0 -translate-x-[40%] -translate-y-[30%] sm:-translate-x-[180%] sm:-translate-y-1/2 p-2 rounded transition-colors'
              >
                <svg
                  className='h-5 w-5 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-500 transition-colors'
                  viewBox='0 0 24 24'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M15 19l-7-7 7-7'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
              <div className='flex-shrink-0 w-full max-w-[200px] sm:max-w-none md:w-72 mx-auto overflow-hidden rounded-2xl rt-poster-frame'>
                <PosterImage
                  src={detail.poster || '/images/placeholder.png'}
                  alt={detail.title || fallbackTitle}
                  width={288}
                  height={432}
                  className='w-full rounded-2xl object-cover aspect-[2/3]'
                  priority
                />
              </div>
              <div className='flex-1 flex flex-col min-h-0 md:min-h-[26rem]'>
                <h1 className='font-display text-2xl sm:text-3xl font-bold mb-2 tracking-tight flex items-center flex-shrink-0 text-center md:text-left w-full text-slate-900 dark:text-slate-50'>
                  {detail.title || fallbackTitle}
                  {detail.douban_id && (
                    <a
                      href={`https://movie.douban.com/subject/${detail.douban_id}/`}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={(e) => e.stopPropagation()}
                      className='ml-2'
                    >
                      <LinkIcon className='w-4 h-4' strokeWidth={2} />
                    </a>
                  )}
                </h1>
                <div className='flex flex-wrap items-center gap-3 text-base mb-4 opacity-80 flex-shrink-0'>
                  {detail.class && (
                    <span className='text-teal-600 font-semibold'>
                      {detail.class}
                    </span>
                  )}
                  {(detail.year || fallbackYear) && (
                    <span>{detail.year || fallbackYear}</span>
                  )}
                  {detail.source_name && (
                    <span className='border border-teal-500/35 bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-[1px] rounded-lg text-sm'>
                      {detail.source_name}
                    </span>
                  )}
                  {detail.type_name && <span>{detail.type_name}</span>}
                </div>
                <div className='flex flex-wrap items-center gap-3 mb-4 flex-shrink-0'>
                  {playRecord ? (
                    <>
                      <a
                        href={`/play?source=${searchParams.get(
                          'source'
                        )}&id=${searchParams.get('id')}&index=${
                          playRecord.index
                        }&title=${encodeURIComponent(detail.title)}${
                          detail.year || fallbackYear
                            ? `&year=${detail.year || fallbackYear}`
                            : ''
                        }`}
                        className='flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors text-white font-semibold dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'
                      >
                        <div className='w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent'></div>
                        <span>
                          继续 ·{' '}
                          {formatResumeLabel({
                            playTime: playRecord.play_time,
                            episodeIndex: playRecord.index,
                            totalEpisodes: playRecord.total_episodes,
                          }) || formatClock(playRecord.play_time)}
                        </span>
                      </a>
                      {/* 从头开始 */}
                      <a
                        href={`/play?source=${searchParams.get(
                          'source'
                        )}&id=${searchParams.get(
                          'id'
                        )}&index=1&position=0&title=${encodeURIComponent(
                          detail.title
                        )}${
                          detail.year || fallbackYear
                            ? `&year=${detail.year || fallbackYear}`
                            : ''
                        }`}
                        className='hidden sm:flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-teal-500/40 hover:text-teal-700 dark:hover:text-teal-300 transition-colors font-medium'
                      >
                        <div className='w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-current border-b-[6px] border-b-transparent'></div>
                        <span>从头开始</span>
                      </a>
                    </>
                  ) : (
                    <>
                      <a
                        href={`/play?source=${searchParams.get(
                          'source'
                        )}&id=${searchParams.get(
                          'id'
                        )}&index=1&position=0&title=${encodeURIComponent(
                          detail.title
                        )}${
                          detail.year || fallbackYear
                            ? `&year=${detail.year || fallbackYear}`
                            : ''
                        }`}
                        className='flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors text-white font-semibold dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'
                      >
                        <div className='w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent'></div>
                        <span>播放</span>
                      </a>
                    </>
                  )}
                  <button
                    onClick={handleToggleFavorite}
                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors border ${
                      favorited
                        ? 'bg-teal-500/15 border-teal-500/40'
                        : 'bg-slate-200/60 border-transparent dark:bg-white/10 hover:border-teal-500/30'
                    }`}
                  >
                    <Heart
                      className={`h-5 w-5 stroke-[2] ${
                        favorited ? 'text-red-500' : 'text-white'
                      }`}
                      fill={favorited ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
                {/* 播放记录进度条 */}
                {playRecord && (
                  <div className='mb-4 flex flex-col gap-1.5 w-full max-w-sm'>
                    <p className='text-sm text-teal-600 dark:text-teal-400 tabular-nums'>
                      {formatResumeLabel({
                        playTime: playRecord.play_time,
                        episodeIndex: playRecord.index,
                        totalEpisodes: playRecord.total_episodes,
                      })}
                      {playRecord.total_time > 0
                        ? ` · 剩余 ${formatDuration(
                            Math.max(
                              0,
                              playRecord.total_time - playRecord.play_time
                            )
                          )}`
                        : ''}
                    </p>
                    <div className='flex items-center gap-3 w-full'>
                      <div className='flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-teal-500 rounded-full'
                          style={{
                            width: `${
                              playRecord.total_time > 0
                                ? (playRecord.play_time /
                                    playRecord.total_time) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {(detail.director || detail.actor) && (
                  <div className='mb-3 text-sm text-slate-600 dark:text-slate-300 space-y-1.5'>
                    {detail.director && (
                      <p>
                        <span className='text-slate-400 mr-2'>导演</span>
                        {detail.director.split(/[,，、/|]/).filter(Boolean).slice(0, 4).map((name) => {
                          const n = name.trim();
                          return (
                            <a
                              key={n}
                              href={`/search?q=${encodeURIComponent(n)}`}
                              className='mr-2 text-teal-600 dark:text-teal-400 hover:underline'
                            >
                              {n}
                            </a>
                          );
                        })}
                      </p>
                    )}
                    {detail.actor && (
                      <p className='leading-relaxed'>
                        <span className='text-slate-400 mr-2'>主演</span>
                        {detail.actor.split(/[,，、/|]/).filter(Boolean).slice(0, 8).map((name) => {
                          const n = name.trim();
                          return (
                            <a
                              key={n}
                              href={`/search?q=${encodeURIComponent(n)}`}
                              className='mr-2 text-teal-600 dark:text-teal-400 hover:underline'
                            >
                              {n}
                            </a>
                          );
                        })}
                      </p>
                    )}
                  </div>
                )}
                {detail.desc && (
                  <details className='group mt-0 text-base leading-relaxed opacity-90 flex-1 min-h-0'>
                    <summary className='cursor-pointer list-none text-sm text-teal-600 dark:text-teal-400 mb-2 select-none'>
                      简介
                      <span className='text-slate-400 group-open:hidden'> · 展开</span>
                      <span className='text-slate-400 hidden group-open:inline'> · 收起</span>
                    </summary>
                    <div
                      className='overflow-y-auto pr-2 max-h-40 sm:max-h-56 scrollbar-hide'
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {detail.desc}
                    </div>
                  </details>
                )}
              </div>
            </div>
            {/* 选集按钮区 */}
            {detail.episodes && detail.episodes.length > 0 && (
              <div className='mt-0 sm:mt-8 bg-transparent rounded-xl p-2 sm:p-6'>
                <div className='flex items-center gap-2 mb-4'>
                  <div className='text-xl font-semibold'>选集</div>
                  <div className='text-gray-400 ml-2'>
                    共 {detail.episodes.length} 集
                  </div>
                  {/* 倒序切换 */}
                  <span
                    onClick={() => setReverseEpisodeOrder((prev) => !prev)}
                    className={`ml-4 text-sm cursor-pointer select-none transition-colors ${
                      reverseEpisodeOrder
                        ? 'text-teal-500'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    倒序
                  </span>
                </div>
                <div className='grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,_minmax(6rem,_6rem))] sm:gap-4 justify-start'>
                  {(reverseEpisodeOrder
                    ? Array.from(
                        { length: detail.episodes.length },
                        (_, i) => i
                      ).reverse()
                    : Array.from(
                        { length: detail.episodes.length },
                        (_, i) => i
                      )
                  ).map((idx) => {
                    const isResumeEp =
                      playRecord && playRecord.index === idx + 1;
                    return (
                      <a
                        key={idx}
                        href={`/play?source=${searchParams.get(
                          'source'
                        )}&id=${searchParams.get('id')}&index=${
                          idx + 1
                        }&position=0&title=${encodeURIComponent(detail.title)}${
                          detail.year || fallbackYear
                            ? `&year=${detail.year || fallbackYear}`
                            : ''
                        }`}
                        className={`px-5 py-2.5 rounded-xl transition-colors text-base font-medium w-24 text-center ${
                          isResumeEp
                            ? 'bg-teal-600 text-white hover:bg-teal-500 ring-2 ring-teal-300/50 dark:bg-teal-500 dark:text-slate-950'
                            : 'bg-slate-500/70 text-white hover:bg-teal-500 dark:bg-slate-700/80 dark:hover:bg-teal-600'
                        }`}
                        title={
                          isResumeEp
                            ? formatResumeLabel({
                                playTime: playRecord!.play_time,
                                episodeIndex: playRecord!.index,
                                totalEpisodes: playRecord!.total_episodes,
                              })
                            : undefined
                        }
                      >
                        {idx + 1}
                        {isResumeEp ? ' ·续' : ''}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function DetailPage() {
  return (
    <Suspense>
      <DetailPageClient />
    </Suspense>
  );
}
