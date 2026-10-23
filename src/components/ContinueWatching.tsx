/* eslint-disable no-console */
'use client';

import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import { clearAllPlayRecords, getAllPlayRecords } from '@/lib/db.client';
import { keywordFromTitle, muteKeyword } from '@/lib/contentHygiene';
import { sortContinueWatching } from '@/lib/continueSort';
import {
  formatResumeLabel,
  progressPercent,
} from '@/lib/playProgress';

import ScrollableRow from '@/components/ScrollableRow';
import SectionHeader from '@/components/SectionHeader';
import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);

        // 从存储获取所有播放记录
        const allRecords = await getAllPlayRecords();

        // 转数组并按 save_time 由近到远排序
        const recordsArray = Object.entries(allRecords).map(
          ([key, record]) => ({
            ...record,
            key,
          })
        );

        setPlayRecords(sortContinueWatching(recordsArray));
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();
  }, []);

  // 没有播放记录则不渲染
  if (!loading && playRecords.length === 0) {
    return null;
  }

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  return (
    <section className={`mb-8 animate-slide-up ${className || ''}`}>
      <SectionHeader
        title='继续观看'
        action={
          !loading && playRecords.length > 0 ? (
            <button
              className='text-sm text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300'
              onClick={async () => {
                await clearAllPlayRecords();
                setPlayRecords([]);
              }}
            >
              清空
            </button>
          ) : undefined
        }
      />
      <ScrollableRow>
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
              >
                <div className='relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-slate-200/80 animate-pulse dark:bg-slate-800' />
                <div className='mt-2 h-4 bg-slate-200/80 rounded animate-pulse dark:bg-slate-800' />
              </div>
            ))
          : playRecords.map((record) => {
              const { source, id } = parseKey(record.key);
              return (
                <div
                  key={record.key}
                  className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                >
                  <VideoCard
                    id={id}
                    title={record.title}
                    poster={record.cover}
                    year={record.year}
                    source={source}
                    source_name={record.source_name}
                    progress={progressPercent(
                      record.play_time,
                      record.total_time
                    )}
                    resumeLabel={formatResumeLabel({
                      playTime: record.play_time,
                      totalTime: record.total_time,
                      episodeIndex: record.index,
                      totalEpisodes: record.total_episodes,
                    })}
                    episodes={record.total_episodes}
                    currentEpisode={record.index}
                    onDelete={() => {
                      muteKeyword(keywordFromTitle(record.title));
                      setPlayRecords((prev) =>
                        prev.filter((r) => r.key !== record.key)
                      );
                    }}
                  />
                </div>
              );
            })}
      </ScrollableRow>
    </section>
  );
}
