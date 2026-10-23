'use client';

import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  isPictureInPictureActive,
  togglePictureInPicture,
} from '@/hooks/usePlaybackChrome';
import {
  getSavedPlaybackRate,
  savePlaybackRate,
} from '@/lib/playbackPrefs';

export function PlaybackRateButton({
  playerRef,
}: {
  playerRef: React.RefObject<any>;
}) {
  const [rate, setRate] = useState(() => getSavedPlaybackRate(1));
  const rates = [0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const saved = getSavedPlaybackRate(1);
    if (saved !== 1) {
      try {
        player.playbackRate = saved;
        setRate(saved);
      } catch {
        /* ignore */
      }
    }
    const unsubscribe = player.subscribe(({ playbackRate }: any) => {
      setRate(playbackRate);
      if (typeof playbackRate === 'number') savePlaybackRate(playbackRate);
    });
    return unsubscribe;
  }, [playerRef]);

  const cycleRate = () => {
    const player = playerRef.current;
    if (!player) return;
    const currentIndex = rates.indexOf(rate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const next = rates[nextIndex];
    player.playbackRate = next;
    savePlaybackRate(next);
  };

  return (
    <button className='vds-button' onClick={cycleRate} type='button'>
      {rate === 1 ? '倍速' : `${rate.toFixed(2)}x`}
    </button>
  );
}

export function FavoriteIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        className='h-5 w-5'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z'
          fill='#ef4444'
          stroke='#ef4444'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return <Heart className='h-5 w-5 stroke-[2] text-gray-300' />;
}

export function PictureInPictureButton({
  playerRef,
}: {
  playerRef: React.RefObject<any>;
}) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setSupported(!!document.pictureInPictureEnabled);
    const sync = () => setActive(isPictureInPictureActive());
    sync();
    document.addEventListener('enterpictureinpicture', sync);
    document.addEventListener('leavepictureinpicture', sync);
    return () => {
      document.removeEventListener('enterpictureinpicture', sync);
      document.removeEventListener('leavepictureinpicture', sync);
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      type='button'
      className='vds-button'
      aria-label={active ? '退出画中画' : '画中画'}
      title={active ? '退出画中画' : '画中画'}
      onClick={() => {
        void togglePictureInPicture(playerRef).then((r) => {
          if (r === 'entered') setActive(true);
          if (r === 'exited') setActive(false);
        });
      }}
    >
      <svg
        className='vds-icon h-6 w-6'
        viewBox='0 0 24 24'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden
      >
        <rect
          x='2'
          y='4'
          width='20'
          height='14'
          rx='2'
          stroke='currentColor'
          strokeWidth='2'
          opacity={active ? 0.45 : 1}
        />
        <rect
          x='11'
          y='11'
          width='9'
          height='6'
          rx='1'
          fill='currentColor'
          opacity={active ? 1 : 0.95}
        />
      </svg>
    </button>
  );
}

export function AdBlockIcon({ enabled }: { enabled: boolean }) {
  const color = enabled ? '#14b8a6' : '#ffffff';
  return (
    <svg
      className='h-6 w-6 vds-icon'
      viewBox='0 0 32 32'
      xmlns='http://www.w3.org/2000/svg'
    >
      <text
        x='50%'
        y='50%'
        fontSize='20'
        fontWeight='bold'
        textAnchor='middle'
        dominantBaseline='middle'
        fill={color}
      >
        AD
      </text>
      <line
        x1='4'
        y1='4'
        x2='28'
        y2='28'
        stroke={color}
        strokeWidth='4'
        strokeLinecap='round'
      />
    </svg>
  );
}
