import { Heart, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { deletePlayRecord, isFavorited, toggleFavorite } from '@/lib/db.client';

import PosterImage from '@/components/PosterImage';

interface VideoCardProps {
  id: string;
  source: string;
  title: string;
  poster: string;
  episodes?: number;
  source_name: string;
  progress?: number;
  /** 续播文案，如「看到 12:30 · 第 3 集」 */
  resumeLabel?: string;
  year?: string;
  from?: string;
  currentEpisode?: number;
  douban_id?: number;
  onDelete?: () => void;
}

function CheckCircleCustom() {
  return (
    <span className='inline-flex items-center justify-center'>
      <svg
        width='24'
        height='24'
        viewBox='0 0 32 32'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <circle cx='16' cy='16' r='13' stroke='white' strokeWidth='2' />
        <path
          d='M11 16.5L15 20L21 13.5'
          stroke='white'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </span>
  );
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
      className={`${className} block relative`}
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

export default function VideoCard({
  id,
  title,
  poster,
  episodes,
  source,
  source_name,
  progress,
  resumeLabel,
  year,
  from,
  currentEpisode,
  douban_id,
  onDelete,
}: VideoCardProps) {
  const [playHover, setPlayHover] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // 检查初始收藏状态
  useEffect(() => {
    (async () => {
      try {
        const fav = await isFavorited(source, id);
        setFavorited(fav);
      } catch (err) {
        throw new Error('检查收藏状态失败');
      }
    })();
  }, [source, id]);

  // 切换收藏状态
  const handleToggleFavorite = async (
    e: React.MouseEvent<HTMLSpanElement | SVGElement, MouseEvent>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const newState = await toggleFavorite(source, id, {
        title,
        source_name,
        year: year || '',
        cover: poster,
        total_episodes: episodes ?? 1,
        save_time: Date.now(),
      });
      setFavorited(newState);
    } catch (err) {
      // 如果删除失败且是收藏夹，恢复显示
      if (isDeleting) {
        setIsDeleting(false);
      }
      throw new Error('切换收藏状态失败');
    }
  };

  // 删除对应播放记录
  const handleDeleteRecord = async (
    e: React.MouseEvent<HTMLSpanElement | SVGElement, MouseEvent>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await deletePlayRecord(source, id);
      onDelete?.();
    } catch (err) {
      throw new Error('删除播放记录失败');
    }
  };

  const hideCheckCircle = from === 'favorites' || from === 'search';
  const alwaysShowHeart = from === 'favorites';

  return (
    <Link
      href={`/detail?source=${source}&id=${id}&title=${encodeURIComponent(
        title
      )}${year ? `&year=${year}` : ''}${from ? `&from=${from}` : ''}`}
    >
      <div
        className={`group relative w-full rounded-lg bg-transparent flex flex-col cursor-pointer transition-all duration-300 ease-in-out ${
          isDeleting ? 'opacity-0 scale-90' : ''
        }`}
      >
        {/* 海报图片容器 */}
        <div className='relative aspect-[2/3] w-full overflow-hidden rounded-2xl rt-poster-frame group-hover:scale-[1.02] transition-all duration-500'>
          <PosterImage
            src={poster}
            alt={title}
            fill
            className='object-cover transition-transform duration-700 ease-out group-hover:scale-110'
            priority={false}
          />
          {/* 常驻底部微渐变，增强标题可读感 */}
          <div
            className='pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent'
            aria-hidden
          />

          {/* Hover 效果层 */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent ${
              alwaysShowHeart
                ? 'opacity-50 group-hover:opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            } transition-all duration-300 cubic-bezier(0.4,0,0.2,1) flex items-center justify-center overflow-hidden`}
          >
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
                    `/play?source=${source}&id=${id}&title=${encodeURIComponent(
                      title
                    )}${year ? `&year=${year}` : ''}`
                  );
                }}
                onMouseEnter={() => setPlayHover(true)}
                onMouseLeave={() => setPlayHover(false)}
              >
                <PlayCircleSolid fillColor={playHover ? '#14b8a6' : 'none'} />
              </div>
            </div>

            {/* 右侧操作按钮组 */}
            <div className='absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex items-center gap-3 transform transition-all duration-300 cubic-bezier(0.4,0,0.2,1) group-hover:scale-110'>
              {!hideCheckCircle && (
                <span
                  onClick={handleDeleteRecord}
                  title='不想看 · 从续看移除'
                  className='inline-flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity duration-200'
                >
                  <CheckCircleCustom />
                </span>
              )}

              <span
                onClick={handleToggleFavorite}
                title={favorited ? '移除收藏' : '加入收藏'}
                className={`inline-flex items-center justify-center ${
                  alwaysShowHeart ? 'opacity-100' : 'opacity-70'
                } hover:opacity-100 transition-opacity duration-200`}
              >
                <Heart
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                    favorited ? 'scale-105 text-red-500' : 'text-white/90'
                  }`}
                  strokeWidth={2}
                  fill={favorited ? 'currentColor' : 'none'}
                />
              </span>
            </div>
          </div>

          {/* 继续观看 - 集数矩形展示框 */}
          {episodes && episodes > 1 && currentEpisode && (
            <div className='absolute top-2 right-2 min-w-[1.875rem] h-5 sm:h-7 sm:min-w-[2.5rem] bg-teal-500/95 backdrop-blur-sm rounded-lg flex items-center justify-center px-2 shadow-md text-[0.55rem] sm:text-xs'>
              <span className='text-white font-bold leading-none'>
                {currentEpisode}
                <span className='mx-1 text-white/80'>/</span>
              </span>
              <span className='text-white font-bold leading-none'>
                {episodes}
              </span>
            </div>
          )}

          {/* 搜索非聚合 - 集数圆形展示框 */}
          {from === 'search' && (
            <div className='absolute top-2 right-2 w-4 h-4 sm:w-7 sm:h-7 rounded-lg bg-teal-500/95 flex items-center justify-center shadow-md text-[0.55rem] sm:text-xs'>
              <span className='text-white font-bold leading-none'>
                {episodes}
              </span>
            </div>
          )}

          {/* 豆瓣链接按钮 */}
          {douban_id && from === 'search' && (
            <a
              href={`https://movie.douban.com/subject/${douban_id}`}
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='absolute top-2 left-2 scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all duration-300 cubic-bezier(0.4,0,0.2,1)'
            >
              <div className='w-4 h-4 sm:w-7 sm:h-7 rounded-lg bg-teal-500 flex items-center justify-center shadow-md opacity-70 hover:opacity-100 transition-all duration-200 ease-in-out hover:scale-110 hover:bg-teal-400'>
                <LinkIcon className='w-4 h-4 text-white' strokeWidth={2} />
              </div>
            </a>
          )}
        </div>

        {progress !== undefined && (
          <div className='rt-progress mt-1.5 w-full'>
            <span style={{ width: `${progress}%` }} />
          </div>
        )}

        <span className='mt-2.5 px-0.5 block text-slate-900 font-medium truncate w-full text-center text-[0.7rem] sm:text-[0.8125rem] leading-snug tracking-tight dark:text-slate-100 transition-all duration-300 group-hover:-translate-y-0.5 opacity-90 group-hover:opacity-100 group-hover:text-teal-700 dark:group-hover:text-teal-300'>
          {title}
        </span>

        {resumeLabel && (
          <span className='mt-1 px-0.5 block text-teal-700/90 dark:text-teal-300/85 text-[0.55rem] sm:text-[11px] w-full text-center truncate tabular-nums'>
            {resumeLabel}
          </span>
        )}

        {source && (
          <span className='mt-1.5 px-0.5 block w-full text-center transition-all duration-300 group-hover:-translate-y-0.5 opacity-75 group-hover:opacity-100'>
            <span className='rt-chip'>{source_name}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
