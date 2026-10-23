'use client';

import { Suspense, useEffect, useState } from 'react';

import { clearAllFavorites, getAllFavorites } from '@/lib/db.client';
import { DoubanItem, DoubanResult } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import BecauseYouWatched from '@/components/BecauseYouWatched';
import ContinueWatching from '@/components/ContinueWatching';
import DemoCard from '@/components/DemoCard';
import HomeDuanjuRow from '@/components/HomeDuanjuRow';
import HomeRecommend from '@/components/HomeRecommend';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import SectionHeader from '@/components/SectionHeader';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';
import {
  formatWatchDuration,
  getWatchStatsSummary,
} from '@/lib/watchStats';

function HomeClient() {
  const [activeTab, setActiveTab] = useState('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [doubanError, setDoubanError] = useState(false);
  const { announcement } = useSite();

  const [showAnnouncement, setShowAnnouncement] = useState(() => {
    const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
    if (hasSeenAnnouncement !== announcement) {
      return true;
    }
    return !hasSeenAnnouncement && Boolean(announcement);
  });

  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [watchHint, setWatchHint] = useState('');

  useEffect(() => {
    const s = getWatchStatsSummary();
    if (s.weekSeconds > 60) {
      const h = s.weekSeconds / 3600;
      const vibe =
        h >= 8 ? '这周看得有点猛' : h >= 3 ? '这周节奏刚好' : '这周轻量补番';
      setWatchHint(
        `${vibe} · 已看 ${formatWatchDuration(s.weekSeconds)}${
          s.todaySeconds > 120
            ? ` · 今天 ${formatWatchDuration(s.todaySeconds)}`
            : ''
        }`
      );
    }
  }, []);

  useEffect(() => {
    const fetchDoubanData = async () => {
      try {
        setLoading(true);
        setDoubanError(false);
        const [moviesResponse, tvShowsResponse] = await Promise.all([
          fetch('/api/douban?type=movie&tag=热门'),
          fetch('/api/douban?type=tv&tag=热门'),
        ]);

        let okAny = false;
        if (moviesResponse.ok) {
          const moviesData: DoubanResult = await moviesResponse.json();
          setHotMovies(moviesData.list || []);
          okAny = true;
        }
        if (tvShowsResponse.ok) {
          const tvShowsData: DoubanResult = await tvShowsResponse.json();
          setHotTvShows(tvShowsData.list || []);
          okAny = true;
        }
        if (!okAny) setDoubanError(true);
      } catch {
        setDoubanError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDoubanData();
  }, []);

  useEffect(() => {
    if (activeTab !== 'favorites') return;

    (async () => {
      const all = await getAllFavorites();
      const sorted = Object.entries(all)
        .sort(([, a], [, b]) => b.save_time - a.save_time)
        .map(([key, fav]) => {
          const plusIndex = key.indexOf('+');
          const source = key.slice(0, plusIndex);
          const id = key.slice(plusIndex + 1);
          return {
            id,
            source,
            title: fav.title,
            year: fav.year,
            poster: fav.cover,
            episodes: fav.total_episodes,
            source_name: fav.source_name,
          } as FavoriteItem;
        });
      setFavoriteItems(sorted);
    })();
  }, [activeTab]);

  const handleCloseAnnouncement = (text: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', text);
  };

  const skeleton = Array.from({ length: 8 }).map((_, index) => (
    <div key={index} className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'>
      <div className='relative aspect-[2/3] w-full overflow-hidden rounded-2xl rt-skeleton' />
      <div className='mt-2.5 h-3.5 w-4/5 mx-auto rounded-md rt-skeleton' />
    </div>
  ));

  return (
    <PageLayout>
      <div className='rt-grain px-2 sm:px-10 py-5 sm:py-9 overflow-visible'>
        <div className='mb-7 sm:mb-10 flex flex-col items-center gap-3 rt-soft-in'>
          <p className='rt-eyebrow hidden sm:block'>welcome</p>
          <h1 className='font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-center'>
            ricktv
          </h1>
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          {watchHint && (
            <p className='text-xs text-slate-500 dark:text-slate-400 tabular-nums max-w-md text-center leading-relaxed'>
              {watchHint}
            </p>
          )}
        </div>

        <div className='max-w-[95%] mx-auto'>
          {activeTab === 'favorites' ? (
            <section className='mb-8 animate-slide-up'>
              <SectionHeader
                title='我的收藏'
                action={
                  favoriteItems.length > 0 ? (
                    <button
                      className='text-sm text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300'
                      onClick={async () => {
                        await clearAllFavorites();
                        setFavoriteItems([]);
                      }}
                    >
                      清空
                    </button>
                  ) : undefined
                }
              />
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8 sm:px-4'>
                {favoriteItems.map((item) => (
                  <div key={item.id + item.source} className='w-full'>
                    <VideoCard {...item} from='favorites' />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className='col-span-full text-center py-16 rt-glass rounded-2xl'>
                    <p className='font-display text-lg text-slate-700 dark:text-slate-200 mb-1'>
                      还没有收藏
                    </p>
                    <p className='text-sm text-slate-500 dark:text-slate-400'>
                      在详情页点心形，片单会出现在这里
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <>
              <ContinueWatching />
              <HomeRecommend hotMovies={hotMovies} hotTvShows={hotTvShows} />
              <BecauseYouWatched />
              <HomeDuanjuRow />

              {doubanError && !loading && (
                <div className='mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200'>
                  热门榜暂时拉不到（网络或豆瓣限制）。搜索页仍可正常用。
                </div>
              )}

              <section className='mb-8 animate-slide-up'>
                <SectionHeader
                  title='热门电影'
                  href='/douban?type=movie&tag=热门&title=热门电影'
                />
                <ScrollableRow>
                  {loading
                    ? skeleton
                    : hotMovies.map((movie, index) => (
                        <div
                          key={movie.id || index}
                          className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                        >
                          <DemoCard
                            id={movie.id}
                            title={movie.title}
                            poster={movie.poster}
                            rate={movie.rate}
                            type='movie'
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>

              <section className='mb-8 animate-slide-up'>
                <SectionHeader
                  title='热门剧集'
                  href='/douban?type=tv&tag=热门&title=热门剧集'
                />
                <ScrollableRow>
                  {loading
                    ? skeleton
                    : hotTvShows.map((show, index) => (
                        <div
                          key={show.id || index}
                          className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                        >
                          <DemoCard
                            id={show.id}
                            title={show.title}
                            poster={show.poster}
                            rate={show.rate}
                            type='tv'
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>

              <section className='mb-8 animate-slide-up'>
                <SectionHeader title='更多发现' />
                <div className='rt-glass rounded-2xl px-4 py-3 sm:px-5 sm:py-4'>
                  <nav className='flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-slate-600 dark:text-slate-300'>
                    {[
                      {
                        label: '短剧',
                        href: '/duanju',
                      },
                      {
                        label: '纪录片',
                        href: '/douban?type=movie&tag=纪录片&title=纪录片',
                      },
                      {
                        label: '欧美',
                        href: '/douban?type=movie&tag=欧美&title=欧美电影',
                      },
                      {
                        label: '英剧',
                        href: '/douban?type=tv&tag=英剧&title=英剧',
                      },
                      {
                        label: '科幻',
                        href: '/douban?type=movie&tag=科幻&title=科幻',
                      },
                      {
                        label: '悬疑',
                        href: '/douban?type=movie&tag=悬疑&title=悬疑',
                      },
                    ].map((x, i) => (
                      <span key={x.href} className='inline-flex items-center'>
                        {i > 0 && (
                          <span
                            className='mx-2 h-3 w-px bg-slate-300/70 dark:bg-slate-600/70'
                            aria-hidden
                          />
                        )}
                        <a
                          href={x.href}
                          className='rounded-md px-1.5 py-0.5 font-medium tracking-wide hover:text-teal-600 dark:hover:text-teal-300 transition-colors'
                        >
                          {x.label}
                        </a>
                      </span>
                    ))}
                  </nav>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {announcement && showAnnouncement && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='w-full max-w-md rounded-2xl rt-glass bg-white/95 dark:bg-slate-950/95 p-6 shadow-2xl shadow-teal-950/20 animate-slide-up'>
            <h3 className='font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white border-b border-teal-500/50 pb-2 mb-4'>
              提示
            </h3>
            <div className='relative overflow-hidden rounded-xl mb-6 bg-teal-50/80 dark:bg-teal-950/30'>
              <div className='absolute inset-y-0 left-0 w-1.5 bg-teal-500' />
              <p className='ml-4 py-3 pr-3 text-slate-600 dark:text-slate-300 leading-relaxed text-sm'>
                {announcement}
              </p>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-4 py-3 shadow-md shadow-teal-500/25 transition-all hover:-translate-y-0.5'
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
