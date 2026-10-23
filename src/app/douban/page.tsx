'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useRef, useState } from 'react';

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

  const type = searchParams.get('type');
  const tag = searchParams.get('tag');

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  useEffect(() => {
    if (!type || !tag) {
      setError('缺少必要参数: type 或 tag');
      setLoading(false);
      return;
    }

    // 重置页面状态
    setDoubanData([]);
    setCurrentPage(0);
    setHasMore(true);
    setError(null);
    setIsLoadingMore(false);

    // 立即加载第一页数据
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/douban?type=${type}&tag=${tag}&pageSize=25&pageStart=0`
        );

        if (!response.ok) {
          throw new Error('获取豆瓣数据失败');
        }

        const data: DoubanResult = await response.json();

        if (data.code === 200) {
          setDoubanData(data.list);
          setHasMore(data.list.length === 25);
        } else {
          throw new Error(data.message || '获取数据失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取豆瓣数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [type, tag]);

  // 单独处理 currentPage 变化（加载更多）
  useEffect(() => {
    if (currentPage > 0 && type && tag) {
      const fetchMoreData = async () => {
        try {
          setIsLoadingMore(true);

          const response = await fetch(
            `/api/douban?type=${type}&tag=${tag}&pageSize=25&pageStart=${
              currentPage * 25
            }`
          );

          if (!response.ok) {
            throw new Error('获取豆瓣数据失败');
          }

          const data: DoubanResult = await response.json();

          if (data.code === 200) {
            setDoubanData((prev) => [...prev, ...data.list]);
            setHasMore(data.list.length === 25);
          } else {
            throw new Error(data.message || '获取数据失败');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '获取豆瓣数据失败');
        } finally {
          setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
  }, [currentPage, type, tag]);

  // 设置滚动监听
  useEffect(() => {
    // 如果没有更多数据或正在加载，则不设置监听
    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    // 确保 loadingRef 存在
    if (!loadingRef.current) {
      return;
    }

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
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading]);

  const getPageTitle = () => {
    // 优先使用 URL 中的 title 参数
    const titleParam = searchParams.get('title');
    if (titleParam) {
      return titleParam;
    }

    // 如果 title 参数不存在，根据 type 和 tag 拼接
    if (!type || !tag) return '豆瓣内容';

    const typeText = type === 'movie' ? '电影' : '电视剧';
    const tagText = tag === 'top250' ? 'Top250' : tag;

    return `${typeText} - ${tagText}`;
  };

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (tag) params.set('tag', tag);
    const titleParam = searchParams.get('title');
    if (titleParam) params.set('title', titleParam);

    const queryString = params.toString();
    const activePath = `/douban${queryString ? `?${queryString}` : ''}`;
    return activePath;
  };

  return (
    <PageLayout activePath={getActivePath()}>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <p className='rt-eyebrow mb-2'>douban</p>
          <h1 className='font-display text-[1.85rem] sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-2'>
            {getPageTitle()}
          </h1>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            来自豆瓣的精选内容
          </p>
        </div>

        {/* 内容展示区域 */}
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
              {/* 内容网格 */}
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
                          type={type || 'movie'}
                        />
                      </div>
                    ))}
              </div>

              {/* 加载更多指示器 */}
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

              {/* 没有更多数据提示 */}
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
