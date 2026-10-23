'use client';

import { FavoriteIcon } from '@/components/play/PlayerIcons';

type Props = {
  videoTitle: string;
  favorited: boolean;
  totalEpisodes: number;
  currentEpisodeIndex: number;
  sourceName: string;
  isFullscreen: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onOpenEpisodes: () => void;
  onOpenSourcePanel: () => void;
};

export default function PlayerTopbar({
  videoTitle,
  favorited,
  totalEpisodes,
  currentEpisodeIndex,
  sourceName,
  isFullscreen,
  onBack,
  onToggleFavorite,
  onOpenEpisodes,
  onOpenSourcePanel,
}: Props) {
  return (
    <div
      data-top-bar
      className='absolute top-0 left-0 right-0 transition-opacity duration-300 z-10 opacity-0 pointer-events-none group-data-[controls]:opacity-100 group-data-[controls]:pointer-events-auto'
    >
      <div className='bg-black/60 backdrop-blur-sm px-0 sm:px-6 py-4 relative flex items-center sm:justify-center'>
        <button
          type='button'
          onClick={onBack}
          className='absolute left-0 sm:left-6 text-white hover:text-gray-300 transition-colors p-2'
        >
          <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'
              fill='currentColor'
            />
          </svg>
        </button>

        <div
          className={`sm:text-center ${
            !isFullscreen ? 'ml-10 sm:ml-0 text-left' : 'w-full text-center'
          }`}
        >
          <div className='flex items-center justify-center gap-2 max-w-xs mx-auto'>
            <span className='text-white font-semibold text-lg truncate'>
              {videoTitle}
            </span>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className='flex-shrink-0'
            >
              <FavoriteIcon filled={favorited} />
            </button>
          </div>

          {totalEpisodes > 1 && (
            <div
              className='text-gray-300 text-sm mt-0.5 cursor-pointer'
              onClick={onOpenEpisodes}
            >
              第 {currentEpisodeIndex + 1} 集 / 共 {totalEpisodes} 集
            </div>
          )}
        </div>

        <div className='absolute right-2 sm:right-6 flex flex-row items-center space-x-1'>
          {totalEpisodes > 1 && (
            <div className='vds-button text-sm' onClick={onOpenEpisodes}>
              选集
            </div>
          )}
          {sourceName && (
            <span
              className='text-gray-300 text-sm border border-gray-500/60 px-2 py-[1px] rounded cursor-pointer hover:bg-gray-600/30 transition-colors'
              onClick={onOpenSourcePanel}
            >
              {sourceName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
