/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
} from '@/lib/db.client';
import { getApiSites } from '@/lib/config';
import { filterHygiene } from '@/lib/contentHygiene';
import {
  collectTypeTags,
  matchTypeTag,
  rankByTitleMatch,
} from '@/lib/fuzzyTitle';
import {
  buildEscapeQueries,
  didYouMeanTitles,
} from '@/lib/searchEscape';
import { getAllSourceHealth, isSourceSuspended } from '@/lib/sourceHealth';
import { streamSearch } from '@/lib/streamSearch';
import { aggregateByFingerprint } from '@/lib/titleFingerprint';
import { SearchResult } from '@/lib/types';

import AggregateCard from '@/components/AggregateCard';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function SearchPageClient() {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [sourceStatus, setSourceStatus] = useState<
    { key: string; name: string; ok: boolean; ms: number; timedOut?: boolean }[]
  >([]);
  const [typeFilter, setTypeFilter] = useState<string>('全部');
  const [suspendedSites, setSuspendedSites] = useState<
    { key: string; name: string }[]
  >([]);
  const [escapeHint, setEscapeHint] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(
    process.env.NEXT_PUBLIC_AGGREGATE_SEARCH_RESULT === 'false' ||
      process.env.NEXT_PUBLIC_AGGREGATE_SEARCH_RESULT === '0'
      ? 'all'
      : 'agg'
  );

  const liveResults = useMemo(
    () =>
      filterHygiene(searchResults).filter((r) => !isSourceSuspended(r.source)),
    [searchResults]
  );

  const rankedResults = useMemo(
    () => rankByTitleMatch(searchQuery, liveResults),
    [searchQuery, liveResults]
  );

  const typeTags = useMemo(
    () => ['全部', ...collectTypeTags(rankedResults)],
    [rankedResults]
  );

  const filteredResults = useMemo(() => {
    if (typeFilter === '全部') return rankedResults;
    return rankedResults.filter((item) => matchTypeTag(item, typeFilter));
  }, [rankedResults, typeFilter]);

  const aggregatedResults = useMemo(() => {
    // 全组都是死源的卡直接丢掉；组内已在 liveResults 里滤过
    return aggregateByFingerprint(filteredResults).filter((g) => g.length > 0);
  }, [filteredResults]);

  useEffect(() => {
    !searchParams.get('q') && searchInputRef.current?.focus();
    getSearchHistory().then(setSearchHistory);
  }, []);

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      setTypeFilter('全部');
      fetchSearchResults(query);
      addSearchHistory(query).then(async () => {
        const history = await getSearchHistory();
        setSearchHistory(history);
      });
    } else {
      setShowResults(false);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [searchParams]);

  const refreshSuspended = () => {
    try {
      getAllSourceHealth();
      const sites = getApiSites()
        .filter((s) => isSourceSuspended(s.key))
        .map((s) => ({ key: s.key, name: s.name }));
      setSuspendedSites(sites);
    } catch {
      setSuspendedSites([]);
    }
  };

  const runOneSearch = async (
    query: string,
    ac: AbortController,
    append: boolean
  ): Promise<SearchResult[]> => {
    let latest: SearchResult[] = append ? [...searchResults] : [];
    await streamSearch(query, {
      signal: ac.signal,
      onSource: (evt, all) => {
        latest = all;
        setSearchResults(all);
        setSourceStatus((prev) => {
          const rest = prev.filter((p) => p.key !== evt.sourceKey);
          return [
            ...rest,
            {
              key: evt.sourceKey,
              name: evt.sourceName,
              ok: evt.ok,
              ms: evt.ms,
              timedOut: evt.timedOut,
            },
          ];
        });
        if (all.length > 0) setIsLoading(false);
      },
    });
    return latest;
  };

  const fetchSearchResults = async (query: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    refreshSuspended();
    try {
      setIsLoading(true);
      setStreaming(true);
      setSearchResults([]);
      setSourceStatus([]);
      setEscapeHint('');
      setSuggestions([]);
      setShowResults(true);

      let all = await runOneSearch(query, ac, false);

      // 空结果 → 递进缩短关键词重试
      if (!ac.signal.aborted && all.length === 0) {
        const escapes = buildEscapeQueries(query);
        for (const alt of escapes) {
          if (ac.signal.aborted) break;
          setEscapeHint(`无结果，改搜「${alt}」…`);
          setSearchResults([]);
          setSourceStatus([]);
          all = await runOneSearch(alt, ac, false);
          if (all.length > 0) {
            setEscapeHint(`已用「${alt}」找到结果`);
            break;
          }
        }
        if (all.length === 0) setEscapeHint('');
      }

      if (all.length > 0) {
        setSuggestions(
          didYouMeanTitles(
            query,
            all.map((x) => x.title),
            4
          )
        );
      }

      refreshSuspended();
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      setSearchResults([]);
    } finally {
      setIsLoading(false);
      setStreaming(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setShowResults(true);
    setTypeFilter('全部');
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    fetchSearchResults(searchQuery);

    addSearchHistory(searchQuery).then(async () => {
      const history = await getSearchHistory();
      setSearchHistory(history);
    });
  };

  const failedSources = sourceStatus.filter((s) => !s.ok);
  const okCount = sourceStatus.filter((s) => s.ok).length;

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
              <input
                ref={searchInputRef}
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='搜索电影、电视剧…（支持近似匹配）'
                className='w-full h-12 rounded-2xl rt-glass py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:text-slate-200 dark:placeholder-slate-500'
              />
            </div>
          </form>
        </div>

        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {isLoading && searchResults.length === 0 ? (
            <div className='flex flex-col justify-center items-center h-40 gap-3'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500'></div>
              <p className='text-sm text-slate-500'>流式聚合中…</p>
            </div>
          ) : showResults ? (
            <section className='mb-12'>
              <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h2 className='font-display text-xl font-bold text-slate-800 dark:text-slate-100'>
                    搜索结果
                    {streaming && (
                      <span className='ml-2 text-xs font-normal text-teal-500'>
                        更新中
                      </span>
                    )}
                  </h2>
                  {sourceStatus.length > 0 && (
                    <p className='text-xs text-slate-500 mt-1'>
                      {okCount}/{sourceStatus.length} 源有结果
                      {failedSources.length > 0 &&
                        ` · ${failedSources.length} 源失败/超时`}
                      {suspendedSites.length > 0 &&
                        ` · ${suspendedSites.length} 源已停用`}
                    </p>
                  )}
                  {escapeHint && (
                    <p className='text-xs text-teal-600 dark:text-teal-400 mt-1'>
                      {escapeHint}
                    </p>
                  )}
                </div>
                <label className='flex items-center gap-2 cursor-pointer select-none'>
                  <span className='text-sm text-slate-600 dark:text-slate-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-teal-500 transition-colors dark:bg-slate-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>

              {typeTags.length > 1 && (
                <div className='mb-4 flex flex-wrap gap-1.5'>
                  {typeTags.map((tag) => (
                    <button
                      key={tag}
                      type='button'
                      onClick={() => setTypeFilter(tag)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        typeFilter === tag
                          ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                          : 'border-slate-300/60 dark:border-slate-600 text-slate-500 hover:border-teal-400/50'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className='mb-4 flex flex-wrap items-center gap-2 text-sm'>
                  <span className='text-slate-500 text-xs'>你是不是要找</span>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type='button'
                      onClick={() => {
                        setSearchQuery(s);
                        router.push(`/search?q=${encodeURIComponent(s)}`);
                      }}
                      className='text-xs px-2.5 py-1 rounded-full border border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10'
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {(failedSources.length > 0 || suspendedSites.length > 0) && (
                <div className='mb-4 flex flex-wrap gap-1.5'>
                  {suspendedSites.map((s) => (
                    <span
                      key={`sus-${s.key}`}
                      className='text-[10px] px-2 py-0.5 rounded-full border border-slate-400/40 text-slate-400 bg-slate-500/10 line-through opacity-70'
                      title='已熔断停用，本次未请求'
                    >
                      {s.name} 停用
                    </span>
                  ))}
                  {failedSources.slice(0, 8).map((s) => (
                    <span
                      key={s.key}
                      className='text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                    >
                      {s.name}
                      {s.timedOut ? ' ⏱' : ' ✗'}
                    </span>
                  ))}
                </div>
              )}

              <div
                key={`search-results-${viewMode}-${typeFilter}`}
                className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
              >
                {viewMode === 'agg'
                  ? aggregatedResults.map((group) => {
                      const key = `${group[0].title}-${
                        group[0].year || 'unknown'
                      }`;
                      return (
                        <div key={`agg-${key}`} className='w-full'>
                          <AggregateCard
                            items={group}
                            query={searchQuery}
                            year={group[0].year}
                          />
                        </div>
                      );
                    })
                  : filteredResults.map((item) => (
                      <div
                        key={`all-${item.source}-${item.id}`}
                        className='w-full'
                      >
                        <VideoCard
                          id={item.id}
                          title={item.title}
                          poster={item.poster}
                          episodes={item.episodes.length}
                          source={item.source}
                          source_name={item.source_name}
                          douban_id={item.douban_id}
                          from='search'
                        />
                      </div>
                    ))}
                {!isLoading &&
                  !streaming &&
                  filteredResults.length === 0 && (
                    <div className='col-span-full text-center text-slate-500 py-8 dark:text-slate-400'>
                      {searchResults.length > 0
                        ? '当前类型下没有结果，换个筛选试试'
                        : '未找到相关结果'}
                    </div>
                  )}
              </div>
            </section>
          ) : searchHistory.length > 0 ? (
            <section className='mb-12'>
              <h2 className='mb-4 font-display text-xl font-bold text-slate-800 text-left dark:text-slate-200'>
                搜索历史
                {searchHistory.length > 0 && (
                  <button
                    onClick={async () => {
                      await clearSearchHistory();
                      setSearchHistory([]);
                    }}
                    className='ml-3 text-sm text-slate-500 hover:text-red-500 transition-colors'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => {
                        setSearchQuery(item);
                        router.push(`/search?q=${encodeURIComponent(item)}`);
                      }}
                      className='px-4 py-2 bg-slate-500/10 hover:bg-slate-300/40 rounded-full text-sm text-slate-700 transition-colors dark:bg-slate-700/50 dark:hover:bg-slate-600 dark:text-slate-300'
                    >
                      {item}
                    </button>
                    <button
                      aria-label='删除搜索历史'
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        await deleteSearchHistory(item);
                        const history = await getSearchHistory();
                        setSearchHistory(history);
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-slate-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
