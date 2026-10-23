'use client';

import { useEffect, useRef } from 'react';

/** TS 4.x DOM lib 可能缺 Wake Lock；本地声明即可 */
type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (
    type: 'release',
    listener: () => void
  ) => void;
};

type PlayerLike = {
  play?: () => Promise<void> | void;
  pause?: () => void;
  currentTime?: number;
  duration?: number;
  paused?: boolean;
  el?: HTMLElement | null;
  $el?: HTMLElement | null;
};

function getVideoEl(player: PlayerLike | null | undefined): HTMLVideoElement | null {
  if (!player) return null;
  const root = player.el || player.$el || null;
  if (root) {
    const v = root.querySelector?.('video') as HTMLVideoElement | null;
    if (v) return v;
  }
  if (typeof document !== 'undefined') {
    return document.querySelector(
      'media-player video, .vds-video video, video'
    ) as HTMLVideoElement | null;
  }
  return null;
}

/**
 * 播放页增强：Media Session（锁屏控制）+ 屏幕常亮 Wake Lock
 */
export function usePlaybackChrome(opts: {
  playerRef: React.RefObject<PlayerLike | null>;
  title: string;
  cover?: string;
  episodeIndex: number;
  totalEpisodes: number;
  enabled?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const {
    playerRef,
    title,
    cover,
    episodeIndex,
    totalEpisodes,
    enabled = true,
    onNext,
    onPrev,
  } = opts;

  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  onNextRef.current = onNext;
  onPrevRef.current = onPrev;

  // Media Session metadata + action handlers
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    const epLabel =
      totalEpisodes > 1 ? `第 ${episodeIndex + 1} 集` : "Rick's Nest";

    try {
      const artwork = cover
        ? [
            { src: cover, sizes: '512x512', type: 'image/jpeg' },
            { src: cover, sizes: '256x256', type: 'image/jpeg' },
          ]
        : [];
      ms.metadata = new MediaMetadata({
        title: title || '播放中',
        artist: epLabel,
        album: "Rick's Nest",
        artwork,
      });
    } catch {
      /* ignore */
    }

    const seekBy = (delta: number) => {
      const p = playerRef.current;
      if (!p || p.currentTime == null) return;
      const dur = p.duration || Number.POSITIVE_INFINITY;
      p.currentTime = Math.max(0, Math.min(dur - 1, p.currentTime + delta));
    };

    const safe = (fn: () => void) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    };

    try {
      ms.setActionHandler('play', () =>
        safe(() => {
          void playerRef.current?.play?.();
        })
      );
      ms.setActionHandler('pause', () =>
        safe(() => {
          playerRef.current?.pause?.();
        })
      );
      ms.setActionHandler('seekbackward', (d) =>
        safe(() => seekBy(-(d.seekOffset || 10)))
      );
      ms.setActionHandler('seekforward', (d) =>
        safe(() => seekBy(d.seekOffset || 10))
      );
      ms.setActionHandler('previoustrack', () =>
        safe(() => onPrevRef.current?.())
      );
      ms.setActionHandler('nexttrack', () =>
        safe(() => onNextRef.current?.())
      );
      ms.setActionHandler('seekto', (d) =>
        safe(() => {
          if (d.seekTime != null && playerRef.current) {
            playerRef.current.currentTime = d.seekTime;
          }
        })
      );
    } catch {
      /* some handlers unsupported */
    }

    return () => {
      try {
        ms.setActionHandler('play', null);
        ms.setActionHandler('pause', null);
        ms.setActionHandler('seekbackward', null);
        ms.setActionHandler('seekforward', null);
        ms.setActionHandler('previoustrack', null);
        ms.setActionHandler('nexttrack', null);
        ms.setActionHandler('seekto', null);
        ms.metadata = null;
      } catch {
        /* ignore */
      }
    };
  }, [
    enabled,
    title,
    cover,
    episodeIndex,
    totalEpisodes,
    playerRef,
  ]);

  // Sync playbackState + position
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    const tick = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        navigator.mediaSession.playbackState = p.paused ? 'paused' : 'playing';
        const duration = p.duration || 0;
        const position = p.currentTime || 0;
        if (duration > 0 && Number.isFinite(duration)) {
          navigator.mediaSession.setPositionState({
            duration,
            position: Math.min(position, duration),
            playbackRate: 1,
          });
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [enabled, playerRef, title, episodeIndex]);

  // Wake Lock while page visible & (roughly) while on play page
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let cancelled = false;

    const release = async () => {
      const cur = wakeLockRef.current;
      wakeLockRef.current = null;
      if (cur) {
        try {
          await cur.release();
        } catch {
          /* ignore */
        }
      }
    };

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      // PiP 时系统自己管屏，不必抢
      if (document.pictureInPictureElement) return;
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener('release', () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
        });
      } catch {
        /* 用户策略 / 省电模式等 */
      }
    };

    void acquire();

    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire();
      else void release();
    };
    const onPip = () => {
      if (document.pictureInPictureElement) void release();
      else void acquire();
    };

    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('enterpictureinpicture', onPip);
    document.addEventListener('leavepictureinpicture', onPip);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('enterpictureinpicture', onPip);
      document.removeEventListener('leavepictureinpicture', onPip);
      void release();
    };
  }, [enabled]);
}

export async function togglePictureInPicture(
  playerRef: React.RefObject<PlayerLike | null>
): Promise<'entered' | 'exited' | 'unsupported' | 'failed'> {
  if (typeof document === 'undefined') return 'unsupported';
  if (!document.pictureInPictureEnabled) return 'unsupported';
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return 'exited';
    }
    const video = getVideoEl(playerRef.current);
    if (!video) return 'failed';
    await video.requestPictureInPicture();
    return 'entered';
  } catch {
    return 'failed';
  }
}

export function isPictureInPictureActive(): boolean {
  return typeof document !== 'undefined' && !!document.pictureInPictureElement;
}
