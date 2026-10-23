'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  buildDiscoverApiUrl,
  DOUBAN_KIND_TAGS,
  type DoubanKind,
} from '@/lib/navCategories';
import { DoubanItem, DoubanResult } from '@/lib/types';

import DemoCard from '@/components/DemoCard';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const kindParam = searchParams.get('kind') as DoubanKind | null;
  const countries = searchParams.get('countries') || '';
  const genres = searchParams.get('genres') || '';
  const type = searchParams.get('type');
  const tag = searchParams.get('tag');

  const useNew =
    !!kindParam && Object.prototype.hasOwnProperty.call(DOUBAN_KIND_TAGS, kindParam);
  const pageSize = useNew ? 20 : 25;

  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  const buildUrl = (page: number) => {
    if (useNew && kindParam) {
      return buildDiscoverApiUrl({
        kind: kindParam,
        countries: countries || undefined,
        genres: genres || undefined,
        sort: 'T',
        start: page * pageSize,
      });
    }
    return `/api/douban?type=${type}&tag=${encodeURIComponent(
      tag || ''
    )}&pageSize=${pageSize}&pageStart=${page * pageSize}`;
  };

  useEffect(() => {
    if (!useNew && (!type || !tag)) {
      setError('缺少必要参数');
      setLoading(false);
      return;
    }

    setDoubanData([]);
    setCurrentPage(0);
    setHasMore(true);
    setError(null);
    setIsLoadingMore(false);

    const loadInitialData = async () => {
      try {
        setLoading(true);
        const response = await fetch(buildUrl(0));
        if (!response.ok) throw new Error('获取豆瓣数据失败');
        const data: DoubanResult = await response.json();
        if (data.code === 200) {
          setDoubanData(data.list);
          setHasMore(data.list.length >= pageSize);
        } else {
          throw new Error(data.message || '获取数据失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取豆瓣数据失败');
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindParam, countries, genres, type, tag, useNew, pageSize]);

  useEffect(() => {
    if (currentPage <= 0) return;
    if (!useNew && (!type || !tag)) return;

    const fetchMoreData = async () => {
      try {
        setIsLoadingMore(true);
        const response = await fetch(buildUrl(currentPage));
        if (!response.ok) throw new Error('获取豆瓣数据失败');
        const data: DoubanResult = await response.json();
        if (data.code === 200) {
          setDoubanData((prev) => [...prev, ...data.list]);
          setHasMore(data.list.length >= pageSize);
        } else {
          throw new Error(data.message || '获取数据失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取豆瓣数据失败');
      } finally {
        setIsLoadingMore(false);
      }
    };

    void fetchMoreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || loading) return;
    if (!loadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, isLoadingMore, loading]);

  const getPageTitle = () => {
    const titleParam = searchParams.get('title');
    if (titleParam) return titleParam;

    if (useNew && kindParam) {
      const parts = [DOUBAN_KIND_TAGS[kindParam]];
      if (countries) parts.push(countries);
      if (genres) parts.push(genres);
      return parts.join(' · ');
    }

    if (!type || !tag) return '豆瓣内容';
    const typeText = type === 'movie' ? '电影' : '电视剧';
    const tagText = tag === 'top250' ? 'Top250' : tag;
    return `${typeText} - ${tagText}`;
  };

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (useNew && kindParam) {
      params.set('kind', kindParam);
      if (countries) params.set('countries', countries);
      if (genres) params.set('genres', genres);
    } else {
      if (type) params.set('type', type);
      if (tag) params.set('tag', tag);
    }
    const titleParam = searchParams.get('title');
    if (titleParam) params.set('title', titleParam);
    const queryString = params.toString();
    return `/douban${queryString ? `?${queryString}` : ''}`;
  };

  const cardType =
    useNew && kindParam
      ? kindParam === 'tv' || kindParam === 'variety'
        ? 'tv'
        : 'movie'
      : type || 'movie';

  return (
    <PageLayout activePath={getActivePath()}>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        <div className='mb-8'>
          <p className='rt-eyebrow mb-2'>douban</p>
          <h1 className='font-display text-[1.85rem] sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-2'>
            {getPageTitle()}
          </h1>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            来自豆瓣的精选内容
          </p>
        </div>

        <div className='max-w-[95%] mx-auto mt-8 overflow-visible'>
          {error ? (
            <div className='flex justify-center items-center h-40'>
              <div className='text-center rt-glass rounded-2xl px-6 py-5'>
                <div className='text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100'>
                  加载失败
                </div>
                <div className='text-sm text-slate-500 mb-4'>{error}</div>
                <button
                  type='button'
                  onClick={() => window.location.reload()}
                  className='text-sm px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950'
                >
                  重试
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8 sm:gap-y-20 sm:px-4'>
                {loading
                  ? skeletonData.map((index) => (
                      <DoubanCardSkeleton key={index} />
                    ))
                  : doubanData.map((item, index) => (
                      <div
                        key={`${item.id || item.title}-${index}`}
                        className='w-full'
                      >
                        <DemoCard
                          id={item.id}
                          title={item.title}
                          poster={item.poster}
                          rate={item.rate}
                          type={cardType}
                        />
                      </div>
                    ))}
              </div>

              {hasMore && !loading && (
                <div
                  ref={(el) => {
                    if (el && el.offsetParent !== null) {
                      (
                        loadingRef as React.MutableRefObject<HTMLDivElement | null>
                      ).current = el;
                    }
                  }}
                  className='flex justify-center mt-12 py-8'
                >
                  {isLoadingMore && (
                    <div className='flex items-center gap-2'>
                      <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500'></div>
                      <span className='text-slate-500'>加载中…</span>
                    </div>
                  )}
                </div>
              )}

              {!hasMore && doubanData.length > 0 && (
                <div className='text-center text-slate-500 py-8 text-sm'>
                  已加载全部内容
                </div>
              )}

              {!loading && doubanData.length === 0 && !error && (
                <div className='text-center text-slate-500 py-8 text-sm'>
                  暂无相关内容
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function DoubanPage() {
  return (
    <Suspense>
      <DoubanPageClient />
    </Suspense>
  );
}
