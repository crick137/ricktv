/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

import {
  type MediaProviderAdapter,
  AirPlayButton,
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
} from '@vidstack/react';
import { AirPlayIcon } from '@vidstack/react/icons';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import Hls from 'hls.js';
import { Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';

import 'vidstack/styles/defaults.css';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

import CoupleNestPanel from '@/components/CoupleNestPanel';
import {
  AdBlockIcon,
  PictureInPictureButton,
  PlaybackRateButton,
} from '@/components/play/PlayerIcons';
import IntroProgressHint from '@/components/play/IntroProgressHint';
import PlayerTopbar from '@/components/play/PlayerTopbar';
import UpNextOverlay from '@/components/UpNextOverlay';
import { usePlaybackChrome } from '@/hooks/usePlaybackChrome';
import {
  deletePlayRecord,
  generateStorageKey,
  getAllPlayRecords,
  isFavorited,
  savePlayRecord,
  toggleFavorite,
} from '@/lib/db.client';
import { type VideoDetail, fetchVideoDetail } from '@/lib/fetchVideoDetail';
import { countM3U8AdCuts, filterAdsFromM3U8 } from '@/lib/m3u8Ads';
import { resolveNextSeason, seriesRootTitle } from '@/lib/seriesTitle';
import {
  getSkipMarker,
  resolveIntroEnd,
  setIntroEnd,
  setOutroStart,
} from '@/lib/skipMarkers';
import {
  isSourceSuspended,
  recordSourceFailure,
  recordSourceSuccess,
} from '@/lib/sourceHealth';
import {
  getPreferredSource,
  setPreferredSource,
} from '@/lib/sourcePref';
import {
  qualityLabel,
  qualityTone,
  rankSourcesByQuality,
  scoreSourceQuality,
} from '@/lib/sourceQuality';
import {
  formatSpeedMs,
  probeMany,
  type SpeedResult,
  speedTone,
} from '@/lib/sourceSpeed';
import { streamSearch } from '@/lib/streamSearch';
import {
  getSubtitlePrefs,
  setSubtitlePrefs,
} from '@/lib/subtitlePrefs';
import { SearchResult } from '@/lib/types';
import {
  addSceneBookmark,
  getBookmarksForTitle,
  removeSceneBookmark,
  type SceneBookmark,
} from '@/lib/sceneBookmarks';
import { fileToVttUrl } from '@/lib/localSubtitles';
import {
  getSavedPlaybackRate,
  getSavedVolume,
  savePlaybackRate,
  saveVolume,
} from '@/lib/playbackPrefs';
import { recordPlayOk } from '@/lib/playConfidence';
import { prefetchUrl } from '@/lib/prefetchPlay';
import { recordTasteSeconds } from '@/lib/watchTaste';
import { recordWatchSeconds } from '@/lib/watchStats';
import { useToast } from '@/components/Toast';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

function PlayPageClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  // @ts-ignore
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 使用 useState 保存视频详情
  const [detail, setDetail] = useState<VideoDetail | null>(null);

  // 初始标题：如果 URL 中携带 title 参数，则优先使用
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const videoYear = searchParams.get('year') || '';
  const [videoCover, setVideoCover] = useState('');

  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');
  const [sourceChanging, setSourceChanging] = useState(false);
  const initialIndex = parseInt(searchParams.get('index') || '1') - 1; // 转换为0基数组索引

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(initialIndex);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(false);
  const [shortcutText, setShortcutText] = useState('');
  const [shortcutDirection, setShortcutDirection] = useState('');
  const [reverseEpisodeOrder, setReverseEpisodeOrder] = useState(false);
  const shortcutHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // NEW STATE: 控制快进/快退按钮是否显示
  const [showSkipButtons, setShowSkipButtons] = useState(true);

  // 使用 ResizeObserver 根据 MediaPlayer 元素尺寸动态决定按钮显隐
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    const updateShowSkipButtons = () => {
      const el: HTMLElement | undefined = (playerRef.current as any)?.el;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // width < 576 或 height < 380 时隐藏
      setShowSkipButtons(!(rect.width < 576 || rect.height < 380));
    };

    // 尝试立即更新一次
    updateShowSkipButtons();

    const observer = new ResizeObserver(updateShowSkipButtons);
    // 有可能此时 el 还未就绪，使用轮询确保绑定
    let retryTimer: NodeJS.Timeout | null = null;
    const attachObserver = () => {
      const el: HTMLElement | undefined = (playerRef.current as any)?.el;
      if (el) {
        observer.observe(el);
        if (retryTimer) clearInterval(retryTimer);
      }
    };

    attachObserver();
    if (!(playerRef.current as any)?.el) {
      // 如果首次未获取到 el，继续重试直至获取
      retryTimer = setInterval(attachObserver, 200);
    }

    // orientationchange 也可能影响高/宽
    window.addEventListener('orientationchange', updateShowSkipButtons);

    return () => {
      observer.disconnect();
      if (retryTimer) clearInterval(retryTimer);
      window.removeEventListener('orientationchange', updateShowSkipButtons);
    };
  }, []);

  // 换源相关状态
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const hasSearchedRef = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [sourceSpeeds, setSourceSpeeds] = useState<
    Record<string, SpeedResult>
  >({});
  const [speedProbing, setSpeedProbing] = useState(false);
  const [searchStreaming, setSearchStreaming] = useState(false);

  // Up Next
  const [upNextOpen, setUpNextOpen] = useState(false);
  const [upNextSeconds, setUpNextSeconds] = useState(8);
  const [seriesFinished, setSeriesFinished] = useState(false);
  const [subScale, setSubScale] = useState(1);
  const [subOffset, setSubOffset] = useState(0);
  const [playMoreOpen, setPlayMoreOpen] = useState(false);
  const upNextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showMarkOutro, setShowMarkOutro] = useState(false);
  const [coupleOpen, setCoupleOpen] = useState(false);
  const [introEndSec, setIntroEndSec] = useState(90);
  const [outroStartSec, setOutroStartSec] = useState<number | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [sceneMarks, setSceneMarks] = useState<SceneBookmark[]>([]);
  const [localSubUrl, setLocalSubUrl] = useState<string | null>(null);
  const [localSubLabel, setLocalSubLabel] = useState('');
  const subInputRef = useRef<HTMLInputElement>(null);
  const lastWatchTickRef = useRef<number>(Date.now());
  const autoSkippedIntroRef = useRef(false);
  const outroFiredRef = useRef(false);
  const failoverCountRef = useRef(0);
  const failoverTriedRef = useRef<Set<string>>(new Set());
  const adToastShownRef = useRef(false);
  const autoBestPickedRef = useRef(false);
  const handleSourceChangeRef = useRef<
    ((s: string, id: string, title: string) => Promise<void>) | null
  >(null);

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // 总集数：从 detail 中获取，保证随 detail 更新而变化
  const totalEpisodes = detail?.episodes?.length || 0;

  // 收藏状态
  const [favorited, setFavorited] = useState(false);
  // 是否显示旋转提示（5s 后自动隐藏）
  const [showOrientationTip, setShowOrientationTip] = useState(false);
  const orientationTipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 当前是否处于竖屏，用于控制"强制横屏"按钮显隐
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: portrait)').matches
      : true
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** 文档级全屏 / 手机横屏时也要藏自定义浮层（一起看、片头提示等） */
  const [isDocFullscreen, setIsDocFullscreen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const hideChromeOverlays =
    isFullscreen ||
    isDocFullscreen ||
    (isMobileViewport && !isPortrait);

  useEffect(() => {
    if (!hideChromeOverlays) return;
    setPlayMoreOpen(false);
    setCoupleOpen(false);
  }, [hideChromeOverlays]);

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number | null>(null);

  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);
  const detailRef = useRef<VideoDetail | null>(detail);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);

  // 标记是否已触发过一次 sourcechange（首次不重建播放器）
  const hasSourceChangedRef = useRef(false);

  // 当播放器因重建而触发一次额外的 sourcechange 时，用于忽略那一次
  const ignoreSourceChangeRef = useRef(false);

  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(getSavedVolume(0.7));
  const savedRateRef = useRef<number>(getSavedPlaybackRate(1));
  const silentFailoverRef = useRef(false);

  // 新增：去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, _setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });

  // 同步最新值到 refs
  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
  }, [currentSource, currentId, detail, currentEpisodeIndex, videoTitle]);

  // 按剧名加载片头 / 片尾 / 书签；字幕字号
  useEffect(() => {
    if (!videoTitle) return;
    setIntroEndSec(resolveIntroEnd(videoTitle, 90));
    const marker = getSkipMarker(videoTitle);
    setOutroStartSec(marker?.outroStart ?? null);
    setSceneMarks(getBookmarksForTitle(videoTitle));
    autoSkippedIntroRef.current = false;
    outroFiredRef.current = false;
    setSeriesFinished(false);
    const prefs = getSubtitlePrefs();
    setSubScale(prefs.scale);
    setSubOffset(prefs.offsetSec);
    setPlayMoreOpen(false);
  }, [videoTitle]);

  // 字幕字号 → CSS 变量
  useEffect(() => {
    const root = playerContainerRef.current;
    if (!root) return;
    root.style.setProperty('--rt-sub-scale', String(subScale));
  }, [subScale]);

  useEffect(() => {
    return () => {
      if (localSubUrl) URL.revokeObjectURL(localSubUrl);
    };
  }, [localSubUrl]);

  // 把本地 VTT 挂到 video 上
  useEffect(() => {
    const root = playerRef.current?.el || playerRef.current?.$el;
    const video = (root?.querySelector?.('video') ||
      document.querySelector('media-player video')) as HTMLVideoElement | null;
    if (!video || !localSubUrl) return;

    // 清掉旧本地轨
    Array.from(video.querySelectorAll('track[data-local-sub]')).forEach((el) =>
      el.remove()
    );
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = localSubLabel || '本地字幕';
    track.srclang = 'zh';
    track.src = localSubUrl;
    track.default = true;
    track.dataset.localSub = '1';
    video.appendChild(track);
    // 开启显示
    try {
      const tt = video.textTracks;
      for (let i = 0; i < tt.length; i++) {
        tt[i].mode = i === tt.length - 1 ? 'showing' : 'disabled';
      }
    } catch {
      /* ignore */
    }

    return () => {
      track.remove();
    };
  }, [localSubUrl, localSubLabel]);

  /**
   * Couple Nest 一起看：把 Vidstack 播放器挂到 window，供 couple-nest-sync.js 精确控制
   * App WebView 通过 postMessage 下发 play/pause/seek
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const api = {
      play: () => {
        try {
          const p = playerRef.current;
          if (p?.play) return p.play();
        } catch {
          /* ignore */
        }
      },
      pause: () => {
        try {
          const p = playerRef.current;
          if (p?.pause) p.pause();
        } catch {
          /* ignore */
        }
      },
      seek: (t: number) => {
        try {
          const p = playerRef.current;
          if (!p) return;
          const dur = p.duration || 0;
          const target = Math.max(
            0,
            Math.min(Number(t) || 0, dur > 0 ? dur - 0.3 : Number(t) || 0)
          );
          p.currentTime = target;
        } catch {
          /* ignore */
        }
      },
      getState: () => {
        const p = playerRef.current;
        if (!p) {
          return { playing: false, currentTime: 0, duration: 0 };
        }
        return {
          playing: !p.paused,
          currentTime: p.currentTime || 0,
          duration: p.duration || 0,
        };
      },
    };

    (window as any).__coupleNestPlayer = api;

    // 通知桥：播放器 API 已就绪
    try {
      const msg = JSON.stringify({
        source: 'couple-nest',
        type: 'event',
        event: 'ready',
        hasPlayer: true,
        player: 'coupleNestPlayer',
        href: location.href,
        title: document.title || videoTitleRef.current || '',
        playing: false,
        currentTime: 0,
        duration: 0,
      });
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(msg);
      }
      window.parent?.postMessage(msg, '*');
    } catch {
      /* ignore */
    }

    return () => {
      try {
        if ((window as any).__coupleNestPlayer === api) {
          delete (window as any).__coupleNestPlayer;
        }
      } catch {
        /* ignore */
      }
    };
  }, [videoUrl, currentEpisodeIndex, currentSource, currentId]);

  // 解决 iOS Safari 100vh 不准确的问题：将视口高度写入 CSS 变量 --vh
  const setVH = useCallback(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty(
        '--vh',
        `${window.innerHeight * 0.01}px`
      );
    }
  }, []);

  // 解决 iOS Safari 100vh 不准确的问题：将视口高度写入 CSS 变量 --vh
  useEffect(() => {
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, [setVH]);

  // 根据 detail 和集数索引更新视频地址（仅当地址真正变化时）
  const updateVideoUrl = (
    detailData: VideoDetail | null,
    episodeIndex: number
  ) => {
    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      setVideoUrl('');
      return;
    }
    const newUrl = detailData?.episodes[episodeIndex] || '';
    if (newUrl !== videoUrl) {
      adToastShownRef.current = false;
      setVideoUrl(newUrl);
      playerContainerRef.current?.focus();
    }
  };

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // 确保初始状态与URL参数同步
  useEffect(() => {
    const urlSource = searchParams.get('source');
    const urlId = searchParams.get('id');

    if (urlSource && urlSource !== currentSource) {
      setCurrentSource(urlSource);
    }
    if (urlId && urlId !== currentId) {
      setCurrentId(urlId);
    }
  }, [searchParams, currentSource, currentId]);

  useEffect(() => {
    if (!currentSource || !currentId) {
      setError('缺少必要参数');
      setLoading(false);
      return;
    }

    const fetchDetail = async () => {
      try {
        const detailData = await fetchVideoDetail({
          source: currentSource,
          id: currentId,
          fallbackTitle: videoTitle,
          fallbackYear: videoYear,
        });

        // 更新状态保存详情
        setVideoTitle(detailData.title || videoTitle);
        setVideoCover(detailData.poster);
        setDetail(detailData);

        // 确保集数索引在有效范围内
        if (currentEpisodeIndex >= detailData.episodes.length) {
          console.log('currentEpisodeIndex', currentEpisodeIndex);
          setCurrentEpisodeIndex(0);
        }

        // 清理URL参数（移除index参数）
        if (searchParams.has('index')) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('index');
          newUrl.searchParams.delete('position');
          window.history.replaceState({}, '', newUrl.toString());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取视频详情失败');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [currentSource]);

  /* -------------------- 播放记录处理 -------------------- */
  useEffect(() => {
    // 仅在初次挂载时检查播放记录
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;

      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        // URL 参数
        const urlIndexParam = searchParams.get('index');
        const urlPositionParam = searchParams.get('position');

        // 当index参数存在时的处理逻辑
        if (urlIndexParam) {
          const urlIndex = parseInt(urlIndexParam, 10) - 1;
          let targetTime = 0; // 默认从0开始

          // 只有index参数和position参数都存在时才生效position
          if (urlPositionParam) {
            targetTime = parseInt(urlPositionParam, 10);
          } else if (record && urlIndex === record.index - 1) {
            // 如果有同集播放记录则跳转到播放记录处
            targetTime = record.play_time;
          }
          // 否则从0开始（targetTime已经是0）

          // 更新当前选集索引
          if (urlIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(urlIndex);
          }

          // 保存待恢复的播放进度，待播放器就绪后跳转
          resumeTimeRef.current = targetTime;
        } else if (record) {
          // 没有index参数但有播放记录时，使用原有逻辑
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;

          // 更新当前选集索引
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }

          // 保存待恢复的播放进度，待播放器就绪后跳转
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, []);

  // 播放器事件处理
  const onCanPlay = () => {
    console.log('播放器准备就绪');
    setError(null);
    failoverCountRef.current = 0;
    failoverTriedRef.current.clear();
    if (currentSourceRef.current) {
      recordSourceSuccess(currentSourceRef.current);
      recordPlayOk(
        currentSourceRef.current,
        currentIdRef.current,
      );
    }
    // 预热下一集首包（不切源，只探活）
    try {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      const nextUrl = d?.episodes?.[idx + 1];
      if (nextUrl) {
        void prefetchUrl(nextUrl, {
          title: videoTitleRef.current,
          source: currentSourceRef.current,
          id: currentIdRef.current,
        });
      }
    } catch {
      /* ignore */
    }
    // 有记忆片头且从开头起播 → 自动跳过
    if (
      !autoSkippedIntroRef.current &&
      getSkipMarker(videoTitleRef.current) &&
      playerRef.current &&
      (resumeTimeRef.current == null || resumeTimeRef.current < 3) &&
      (playerRef.current.currentTime || 0) < 5
    ) {
      try {
        playerRef.current.currentTime = resolveIntroEnd(
          videoTitleRef.current,
          90
        );
        autoSkippedIntroRef.current = true;
        setShowSkipIntro(false);
      } catch {
        /* ignore */
      }
    }

    // 若存在需要恢复的播放进度，则跳转
    if (
      playerRef.current &&
      resumeTimeRef.current &&
      resumeTimeRef.current > 0
    ) {
      try {
        const duration = playerRef.current.duration || 0;
        let target = resumeTimeRef.current;
        // 如果目标时间距离结尾过近，为避免自动触发下一集，向前偏移 5 秒
        if (duration && target >= duration - 2) {
          target = Math.max(0, duration - 5);
        }
        playerRef.current.currentTime = target;
      } catch (err) {
        console.warn('恢复播放进度失败:', err);
      }
      resumeTimeRef.current = null;
    }

    if (playerRef.current) {
      setTimeout(() => {
        try {
          playerRef.current.volume = lastVolumeRef.current;
          if (savedRateRef.current && savedRateRef.current !== 1) {
            playerRef.current.playbackRate = savedRateRef.current;
          }
        } catch (_) {
          // 忽略异常
        }
      }, 0);
    }
  };

  const clearUpNext = useCallback(() => {
    if (upNextTimerRef.current) {
      clearInterval(upNextTimerRef.current);
      upNextTimerRef.current = null;
    }
    setUpNextOpen(false);
    setUpNextSeconds(8);
    setSeriesFinished(false);
  }, []);

  const goNextEpisode = useCallback(() => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    clearUpNext();
    if (d && d.episodes && idx < d.episodes.length - 1) {
      outroFiredRef.current = false;
      autoSkippedIntroRef.current = false;
      const next = idx + 1;
      setCurrentEpisodeIndex(next);
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('index', String(next + 1));
        window.history.replaceState({}, '', newUrl.toString());
        (window as any).__coupleNestEmit?.('navigate');
      } catch {
        /* ignore */
      }
    }
  }, [clearUpNext]);

  const onEnded = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      setSeriesFinished(false);
      setUpNextOpen(true);
      setUpNextSeconds(8);
      if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
      upNextTimerRef.current = setInterval(() => {
        setUpNextSeconds((s) => {
          if (s <= 1) {
            if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
            upNextTimerRef.current = null;
            // 下一帧再切集，避免在 setState 里副作用
            setTimeout(() => goNextEpisode(), 0);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      // 全剧看完 → 续推
      setSeriesFinished(true);
      setUpNextOpen(true);
    }
  };

  // 换源列表就绪后测速；明显更快的源则自动切换（一次）
  useEffect(() => {
    if (!searchResults.length) {
      setSourceSpeeds({});
      autoBestPickedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setSpeedProbing(true);
      const epIdx = currentEpisodeIndexRef.current || 0;
      const items = searchResults
        .map((r) => {
          const url = r.episodes?.[epIdx] || r.episodes?.[0] || '';
          return {
            key: `${r.source}-${r.id}`,
            url,
          };
        })
        .filter((x) => x.url);
      const results = await probeMany(items, 4);
      if (cancelled) return;
      setSourceSpeeds(results);
      setSpeedProbing(false);

      if (autoBestPickedRef.current || !handleSourceChangeRef.current) return;

      const curKey = `${currentSourceRef.current}-${currentIdRef.current}`;
      const curSpeed = results[curKey];
      const pref = getPreferredSource(videoTitleRef.current);
      const ranked = rankSourcesByQuality(searchResults, {
        speeds: results,
        title: videoTitleRef.current,
      });
      const best = ranked[0];
      if (!best) return;
      const bestKey = `${best.source}-${best.id}`;
      if (bestKey === curKey) return;
      const bestSpeed = results[bestKey];
      const curScore = scoreSourceQuality({
        source: currentSourceRef.current,
        id: currentIdRef.current,
        speed: curSpeed,
        preferredSource: pref,
        episodeCount: detailRef.current?.episodes?.length || 0,
      });
      const bestScore = scoreSourceQuality({
        source: best.source,
        id: best.id,
        speed: bestSpeed,
        preferredSource: pref,
        episodeCount: best.episodes?.length || 0,
      });

      const preferOk =
        !!pref &&
        best.source === pref &&
        (curKey.split('-')[0] !== pref || !curSpeed?.ok);

      // 质量分显著更高，或偏好源，或当前测速失败
      const shouldSwitch =
        preferOk ||
        !curSpeed?.ok ||
        bestScore - curScore >= 900;

      if (!shouldSwitch) return;
      autoBestPickedRef.current = true;
      silentFailoverRef.current = true;
      toast(
        preferOk && best.source === pref
          ? `已切到偏好源：${best.source_name}`
          : `已自动切换优质源：${best.source_name}`
      );
      void handleSourceChangeRef.current(
        best.source,
        best.id,
        best.title || videoTitleRef.current
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [searchResults]);

  const onTimeUpdate = () => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 5000) {
      saveCurrentPlayProgress();
      lastSaveTimeRef.current = now;
    }
    const player = playerRef.current;
    const t = player?.currentTime ?? 0;
    const duration = player?.duration ?? 0;
    if (duration && Number.isFinite(duration)) setMediaDuration(duration);
    const introEnd = introEndSec || 90;
    setShowSkipIntro(t > 3 && t < introEnd);

    // 接近片尾时显示「记住片尾」；已有记忆则略早于片尾也可改
    const nearEnd =
      duration > 120 &&
      t > Math.max(introEnd + 30, duration * 0.55) &&
      t < duration - 8;
    setShowMarkOutro(nearEnd);

    // 片尾记忆：进入 outro 区间视为本集结束 → Up Next
    const marker = getSkipMarker(videoTitleRef.current);
    const outroAt = marker?.outroStart ?? outroStartSec;
    if (
      outroAt &&
      duration > 0 &&
      t >= outroAt &&
      !outroFiredRef.current &&
      !upNextOpen
    ) {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && d.episodes && idx < d.episodes.length - 1) {
        outroFiredRef.current = true;
        try {
          player.pause?.();
        } catch {
          /* ignore */
        }
        onEnded();
      }
    }
  };

  const handleSkipIntro = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const end = introEndSec || 90;
      player.currentTime = end;
      setShowSkipIntro(false);
      // 记住本次跳过位置为片头结束（LibreTV Shift+I 语义简化）
      if (videoTitleRef.current) {
        setIntroEnd(videoTitleRef.current, end);
        setIntroEndSec(end);
      }
    } catch {
      /* ignore */
    }
  };

  const handleRememberIntroHere = () => {
    const t = playerRef.current?.currentTime;
    if (t == null || t < 5 || !videoTitleRef.current) return;
    setIntroEnd(videoTitleRef.current, t);
    setIntroEndSec(Math.round(t));
    try {
      playerRef.current.currentTime = t;
    } catch {
      /* ignore */
    }
    setShowSkipIntro(false);
    toast(`已记住片头结束 ${Math.round(t)}s`);
  };

  const handleRememberOutroHere = () => {
    const t = playerRef.current?.currentTime;
    if (t == null || t < 30 || !videoTitleRef.current) return;
    setOutroStart(videoTitleRef.current, t);
    setOutroStartSec(Math.round(t));
    setShowMarkOutro(false);
    toast(`已记住片尾起点 ${Math.round(t)}s`);
  };

  const handleRememberScene = () => {
    const t = playerRef.current?.currentTime;
    if (t == null || t < 1 || !videoTitleRef.current) return;
    const item = addSceneBookmark(videoTitleRef.current, t);
    if (item) {
      setSceneMarks(getBookmarksForTitle(videoTitleRef.current));
      toast(`已收藏 ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
    }
  };

  const handleLocalSubtitle = async (file: File | null) => {
    if (!file) return;
    try {
      if (localSubUrl) URL.revokeObjectURL(localSubUrl);
      const { url, label } = await fileToVttUrl(file);
      setLocalSubUrl(url);
      setLocalSubLabel(label);
      toast(`已加载字幕：${label}`);
    } catch {
      toast('字幕加载失败', 'err');
    }
  };

  const handlePlayerError = (e: any) => {
    console.error('播放器错误:', e);
    const src = currentSourceRef.current;
    const curId = currentIdRef.current;
    const curKey = `${src}-${curId}`;
    if (src) recordSourceFailure(src, { error: 'playback' });
    failoverTriedRef.current.add(curKey);

    // 自动换更快源（最多 4 次，避开已试过的）
    if (failoverCountRef.current >= 4) {
      setError('已试过多个源都失败了。点「换源」手动挑一个，或稍后再试。');
      return;
    }

    const results = searchResults.filter(
      (r) =>
        !failoverTriedRef.current.has(`${r.source}-${r.id}`) &&
        !isSourceSuspended(r.source)
    );
    if (!results.length) {
      setError('视频播放失败（可点换源重试）');
      if (videoTitleRef.current && !hasSearchedRef.current) {
        handleSearch(videoTitleRef.current);
        hasSearchedRef.current = true;
      }
      return;
    }

    const ranked = rankSourcesByQuality(results, {
      speeds: sourceSpeeds,
      title: videoTitleRef.current,
    });
    const next = ranked[0];
    if (!next || !handleSourceChangeRef.current) {
      setError('视频播放失败');
      return;
    }
    failoverCountRef.current += 1;
    failoverTriedRef.current.add(`${next.source}-${next.id}`);
    // 静默换源：不挡画面大遮罩，只 toast
    silentFailoverRef.current = true;
    toast(`源不稳，静默切换 ${next.source_name}…`);
    void handleSourceChangeRef.current(
      next.source,
      next.id,
      next.title || videoTitle
    );
  };

  // 页面卸载和隐藏时保存播放进度
  useEffect(() => {
    // 页面即将卸载时保存播放进度
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
    };

    // 页面可见性变化时保存播放进度
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail, playerRef.current]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (shortcutHintTimeoutRef.current) {
        clearTimeout(shortcutHintTimeoutRef.current);
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // 当视频标题变化时重置搜索状态
  useEffect(() => {
    if (videoTitle) {
      hasSearchedRef.current = false;
      setSearchResults([]);
      setSearchError(null);
    }
  }, [videoTitle]);

  // 添加键盘事件监听器 (使用 refs 避免重复绑定)
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  const syncEpisodeToUrl = (episodeIndex: number) => {
    try {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('index', String(episodeIndex + 1));
      window.history.replaceState({}, '', newUrl.toString());
      (window as any).__coupleNestEmit?.('navigate');
    } catch {
      /* ignore */
    }
  };

  // 处理选集切换
  const handleEpisodeChange = (episodeIndex: number) => {
    if (episodeIndex >= 0 && episodeIndex < totalEpisodes) {
      // 在更换集数前保存当前播放进度
      if (playerRef.current && !playerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(episodeIndex);
      syncEpisodeToUrl(episodeIndex);
      setShowEpisodePanel(false);
    }
  };

  // 处理下一集
  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      if (playerRef.current && !playerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      const next = idx + 1;
      setCurrentEpisodeIndex(next);
      syncEpisodeToUrl(next);
    }
  };

  // 处理上一集
  const handlePreviousEpisode = () => {
    const idx = currentEpisodeIndexRef.current;
    if (detailRef.current && idx > 0) {
      if (playerRef.current && !playerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      const prev = idx - 1;
      setCurrentEpisodeIndex(prev);
      syncEpisodeToUrl(prev);
    }
  };

  // 锁屏控制 + 屏幕常亮
  usePlaybackChrome({
    playerRef,
    title: videoTitle,
    cover: videoCover,
    episodeIndex: currentEpisodeIndex,
    totalEpisodes,
    enabled: !!videoUrl && !loading,
    onNext: handleNextEpisode,
    onPrev: handlePreviousEpisode,
  });

  /** 换源列表：每源只留一条，优先标题/年份/剧集形态匹配 */
  const pickSourceMatches = useCallback(
    (raw: SearchResult[]) => {
      const sourceMap = new Map<string, SearchResult[]>();
      raw.forEach((result) => {
        if (!sourceMap.has(result.source)) sourceMap.set(result.source, []);
        sourceMap.get(result.source)!.push(result);
      });

      const processed: SearchResult[] = [];
      const titleLc = videoTitle.toLowerCase();
      const yearLc = videoYear.toLowerCase();
      const epLen = detailRef.current?.episodes.length || 0;

      sourceMap.forEach((results) => {
        if (!results.length) return;
        const exactMatch = results.find(
          (result) =>
            result.title.toLowerCase() === titleLc &&
            (videoYear ? result.year.toLowerCase() === yearLc : true) &&
            epLen > 0 &&
            ((epLen === 1 && result.episodes.length === 1) ||
              (epLen > 1 && result.episodes.length > 1))
        );
        if (exactMatch) processed.push(exactMatch);
      });
      return processed;
    },
    [videoTitle, videoYear]
  );

  // 搜索视频源（流式：先到先画）
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;

    setSearchLoading(true);
    setSearchStreaming(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      await streamSearch(query, {
        signal: ac.signal,
        onSource: (_evt, all) => {
          const picked = pickSourceMatches(all);
          setSearchResults(picked);
          if (picked.length > 0) setSearchLoading(false);
        },
        onDone: (all) => {
          setSearchResults(pickSourceMatches(all));
          setSearchLoading(false);
          setSearchStreaming(false);
        },
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setSearchError(err instanceof Error ? err.message : '搜索失败');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
      setSearchStreaming(false);
    }
  };

  // 处理换源（静默 failover 时不挡全屏遮罩）
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    const silent = silentFailoverRef.current;
    silentFailoverRef.current = false;
    try {
      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = playerRef.current?.currentTime || 0;

      if (!silent) setSourceChanging(true);
      setError(null);

      // 清除前一个历史记录
      if (currentSource && currentId) {
        try {
          await deletePlayRecord(currentSource, currentId);
          console.log('已清除前一个播放记录');
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      // 获取新源的详情
      const newDetail = await fetchVideoDetail({
        source: newSource,
        id: newId,
        fallbackTitle: newTitle,
        fallbackYear: videoYear,
      });

      // 尝试跳转到当前正在播放的集数
      let targetIndex = currentEpisodeIndex;

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      // 如果仍然是同一集数且播放进度有效，则在播放器就绪后恢复到原始进度
      if (targetIndex === currentEpisodeIndex && currentPlayTime > 1) {
        resumeTimeRef.current = currentPlayTime;
      } else {
        // 否则从头开始播放，防止影响后续选集逻辑
        resumeTimeRef.current = 0;
      }

      // 更新URL参数（不刷新页面）
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      window.history.replaceState({}, '', newUrl.toString());
      try {
        (window as any).__coupleNestEmit?.('navigate');
      } catch {
        /* ignore */
      }

      // 关闭换源面板
      setShowSourcePanel(false);

      setVideoTitle(newDetail.title || newTitle);
      setVideoCover(newDetail.poster);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
      outroFiredRef.current = false;
      autoSkippedIntroRef.current = false;
      setPreferredSource(newDetail.title || newTitle, newSource);
      if (silent) {
        toast(`已切到 ${newDetail.source_name || newSource}`);
      } else {
        toast(`已切换：${newDetail.source_name || newSource}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '换源失败');
    } finally {
      setSourceChanging(false);
    }
  };
  handleSourceChangeRef.current = handleSourceChange;

  // 进页即搜同名源，便于测速自动选源 / 失败切源
  useEffect(() => {
    if (!videoTitle || hasSearchedRef.current) return;
    hasSearchedRef.current = true;
    void handleSearch(videoTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoTitle]);

  // 处理播放源面板展开
  const handleSourcePanelOpen = () => {
    setShowSourcePanel(true);
    playerContainerRef.current?.focus();
    if (videoTitle && !hasSearchedRef.current) {
      handleSearch(videoTitle);
      hasSearchedRef.current = true;
    }
  };

  // 显示快捷键提示
  const displayShortcutHint = (text: string, direction: string) => {
    setShortcutText(text);
    setShortcutDirection(direction);
    setShowShortcutHint(true);

    // 清除之前的超时
    if (shortcutHintTimeoutRef.current) {
      clearTimeout(shortcutHintTimeoutRef.current);
    }

    // 2秒后隐藏
    shortcutHintTimeoutRef.current = setTimeout(() => {
      setShowShortcutHint(false);
    }, 2000);
  };

  // 处理全局快捷键
  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    // 忽略输入框中的按键事件
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        displayShortcutHint('上一集', 'left');
      } else {
        displayShortcutHint('已经是第一集了', 'error');
      }
      e.preventDefault();
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        displayShortcutHint('下一集', 'right');
      } else {
        displayShortcutHint('已经是最后一集了', 'error');
      }
      e.preventDefault();
    }

    if (!playerRef.current) return;
    const player = playerRef.current;

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
      if (player.currentTime > 5) {
        player.currentTime -= 10;
        displayShortcutHint('快退', 'left');
      }
      e.preventDefault();
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
      if (player.currentTime < player.duration - 5) {
        player.currentTime += 10;
        displayShortcutHint('快进', 'right');
      }
      e.preventDefault();
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
      const currentVolume = player.volume;
      if (currentVolume < 1) {
        player.volume += 0.1;
        displayShortcutHint(
          `音量 ${Math.round((currentVolume + 0.1) * 100)}`,
          'up'
        );
      } else {
        displayShortcutHint('音量 100', 'up');
      }
      e.preventDefault();
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
      const currentVolume = player.volume;
      if (currentVolume > 0) {
        player.volume -= 0.1;
        displayShortcutHint(
          `音量 ${Math.round((currentVolume - 0.1) * 100)}`,
          'down'
        );
      } else {
        displayShortcutHint('音量 0', 'down');
      }
      e.preventDefault();
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
      if (playerRef.current.paused) {
        playerRef.current.play();
        displayShortcutHint('播放', 'play');
      } else {
        playerRef.current.pause();
        displayShortcutHint('暂停', 'pause');
      }
      e.preventDefault();
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
      if (player.state.fullscreen) {
        player.exitFullscreen();
      } else {
        player.enterFullscreen();
      }
      e.preventDefault();
    }

    // J / L = ±10s；K = 播放暂停（YouTube 习惯）
    if (e.key === 'j' || e.key === 'J') {
      player.currentTime = Math.max(0, (player.currentTime || 0) - 10);
      displayShortcutHint('快退 10s', 'left');
      e.preventDefault();
    }
    if (e.key === 'l' || e.key === 'L') {
      const dur = player.duration || Number.POSITIVE_INFINITY;
      player.currentTime = Math.min(
        (player.currentTime || 0) + 10,
        Number.isFinite(dur) ? dur - 0.5 : (player.currentTime || 0) + 10
      );
      displayShortcutHint('快进 10s', 'right');
      e.preventDefault();
    }
    if (e.key === 'k' || e.key === 'K') {
      if (player.paused) {
        player.play();
        displayShortcutHint('播放', 'play');
      } else {
        player.pause();
        displayShortcutHint('暂停', 'pause');
      }
      e.preventDefault();
    }

    // [ / ] 字幕字号；, / . 字幕偏移（下次加载生效）
    if (e.key === '[') {
      const cur = getSubtitlePrefs();
      const next = setSubtitlePrefs({ scale: cur.scale - 0.1 });
      setSubScale(next.scale);
      displayShortcutHint(`字幕 ${Math.round(next.scale * 100)}%`, 'down');
      e.preventDefault();
    }
    if (e.key === ']') {
      const cur = getSubtitlePrefs();
      const next = setSubtitlePrefs({ scale: cur.scale + 0.1 });
      setSubScale(next.scale);
      displayShortcutHint(`字幕 ${Math.round(next.scale * 100)}%`, 'up');
      e.preventDefault();
    }
    if (e.key === ',') {
      const cur = getSubtitlePrefs();
      const next = setSubtitlePrefs({ offsetSec: cur.offsetSec - 0.5 });
      setSubOffset(next.offsetSec);
      displayShortcutHint(`字幕偏移 ${next.offsetSec.toFixed(1)}s`, 'left');
      e.preventDefault();
    }
    if (e.key === '.') {
      const cur = getSubtitlePrefs();
      const next = setSubtitlePrefs({ offsetSec: cur.offsetSec + 0.5 });
      setSubOffset(next.offsetSec);
      displayShortcutHint(`字幕偏移 ${next.offsetSec.toFixed(1)}s`, 'right');
      e.preventDefault();
    }

    // I = 跳过片头；B = 收藏此刻
    if (e.key === 'i' || e.key === 'I') {
      handleSkipIntro();
      displayShortcutHint('跳过片头', 'right');
      e.preventDefault();
    }
    if (e.key === 'b' || e.key === 'B') {
      handleRememberScene();
      e.preventDefault();
    }
  };

  // 保存播放进度的函数
  const saveCurrentPlayProgress = async () => {
    if (
      !playerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const player = playerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name,
        cover: videoCover,
        year: detailRef.current?.year || videoYear || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: totalEpisodes,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
      });

      const now = Date.now();
      const deltaSec = Math.min(
        30,
        Math.max(0, Math.round((now - lastWatchTickRef.current) / 1000))
      );
      if (deltaSec >= 3 && !player.paused) {
        recordWatchSeconds(deltaSec);
        const taste =
          detailRef.current?.type_name ||
          detailRef.current?.class ||
          (totalEpisodes > 1 ? '剧集' : '电影');
        recordTasteSeconds(taste, deltaSec);
      }
      lastWatchTickRef.current = now;
      lastSaveTimeRef.current = now;
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

  // 每当 source 或 id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (!currentSource || !currentId) return;

    try {
      const newState = await toggleFavorite(currentSource, currentId, {
        title: videoTitle,
        source_name: detail?.source_name || '',
        year: detail?.year || videoYear || '',
        cover: videoCover || '',
        total_episodes: totalEpisodes || 1,
        save_time: Date.now(),
      });
      setFavorited(newState);
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  // 监听屏幕方向变化：竖屏时显示提示蒙层
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(orientation: portrait)');

    const update = () => {
      const portrait = mql.matches;

      // 更新竖屏状态
      setIsPortrait(portrait);

      // 在进入竖屏时显示提示，5 秒后自动隐藏
      if (portrait) {
        setShowOrientationTip(true);
        if (orientationTipTimeoutRef.current) {
          clearTimeout(orientationTipTimeoutRef.current);
        }
        orientationTipTimeoutRef.current = setTimeout(() => {
          setShowOrientationTip(false);
        }, 5000);
      } else {
        setShowOrientationTip(false);
        if (orientationTipTimeoutRef.current) {
          clearTimeout(orientationTipTimeoutRef.current);
          orientationTipTimeoutRef.current = null;
        }
      }
    };

    // 初始执行一次
    update();

    if (mql.addEventListener) {
      mql.addEventListener('change', update);
    } else {
      // Safari < 14
      // @ts-ignore
      mql.addListener(update);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', update);
      } else {
        // @ts-ignore
        mql.removeListener(update);
      }
    };
  }, []);

  // 用户点击悬浮按钮 / 全屏：优先播放器全屏，再锁横屏
  const handleForceLandscape = async () => {
    try {
      const player: any = playerRef.current;
      if (player?.enterFullscreen) {
        try {
          await player.enterFullscreen();
        } catch {
          /* fall through to document FS */
        }
      }
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement
      ) {
        const el: any = player?.el || document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      }

      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (err) {
      console.warn('强制横屏失败:', err);
    }
  };

  // 文档全屏（手机「强制横屏」走的是 html.requestFullscreen，不是播放器 fullscreen）
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncDocFs = () => {
      const fs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsDocFullscreen(fs);
      if (fs) {
        setPlayMoreOpen(false);
        setCoupleOpen(false);
      }
    };
    const mq = window.matchMedia('(max-width: 767px)');
    const syncMobile = () => setIsMobileViewport(mq.matches);
    syncDocFs();
    syncMobile();
    document.addEventListener('fullscreenchange', syncDocFs);
    document.addEventListener('webkitfullscreenchange', syncDocFs as EventListener);
    mq.addEventListener?.('change', syncMobile);
    return () => {
      document.removeEventListener('fullscreenchange', syncDocFs);
      document.removeEventListener(
        'webkitfullscreenchange',
        syncDocFs as EventListener
      );
      mq.removeEventListener?.('change', syncMobile);
    };
  }, []);

  // 进入/退出全屏时锁定/解锁横屏（保持原有逻辑）
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const lockLandscape = async () => {
      try {
        // 某些浏览器需要在用户手势触发后才能调用
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape');
        }
      } catch (err) {
        console.warn('横屏锁定失败:', err);
      }
    };

    const unlock = () => {
      try {
        if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      } catch (_) {
        // 忽略解锁屏幕方向失败的错误
      }
    };

    const player = playerRef.current;
    if (!player) return;

    return player.subscribe(({ fullscreen }: any) => {
      setIsFullscreen(fullscreen);
      if (fullscreen) {
        setPlayMoreOpen(false);
        setCoupleOpen(false);
        lockLandscape();
      } else {
        unlock();
        // 强制重绘逻辑，解决退出全屏的黑屏/白边问题
        const playerEl = playerRef.current?.el as HTMLElement | null;
        if (playerEl) {
          playerEl.style.display = 'none';
          setTimeout(() => {
            playerEl.style.display = '';
            setVH();
          }, 0);
        }
      }
    });
  }, [playerRef.current, setVH]);

  useEffect(() => {
    // 播放页挂载时，锁定页面滚动并消除 body 100vh 带来的额外空白
    if (typeof document === 'undefined') return;

    const { style: bodyStyle } = document.body;
    const { style: htmlStyle } = document.documentElement;

    // 记录原始样式，供卸载时恢复
    const originalBodyMinH = bodyStyle.minHeight;
    const originalBodyH = bodyStyle.height;
    const originalBodyOverflow = bodyStyle.overflow;
    const originalHtmlOverflow = htmlStyle.overflow;

    bodyStyle.minHeight = '0';
    bodyStyle.height = 'auto';
    bodyStyle.overflow = 'hidden';
    htmlStyle.overflow = 'hidden';

    return () => {
      bodyStyle.minHeight = originalBodyMinH;
      bodyStyle.height = originalBodyH;
      bodyStyle.overflow = originalBodyOverflow;
      htmlStyle.overflow = originalHtmlOverflow;
    };
  }, []);

  /* -------------------- 设置 meta theme-color 为纯黑 -------------------- */
  useEffect(() => {
    const originalThemeColorTags = Array.from(
      document.querySelectorAll('meta[name="theme-color"]')
    );

    // 移除已有的 theme-color 标签
    originalThemeColorTags.forEach((tag) => tag.remove());

    // 添加播放页专用的 theme-color 标签
    const playerThemeColorTag = document.createElement('meta');
    playerThemeColorTag.name = 'theme-color';
    playerThemeColorTag.content = '#000000';
    document.head.appendChild(playerThemeColorTag);

    // 组件卸载时恢复原有的 theme-color 标签
    return () => {
      playerThemeColorTag.remove();
      originalThemeColorTags.forEach((tag) => document.head.appendChild(tag));
    };
  }, []);

  // Safari(WebKit) 专用：用于强制重新挂载 <MediaPlayer>，实现"销毁并重建"效果
  const [playerReloadKey, setPlayerReloadKey] = useState(0);

  // 实时记录音量变化
  const handleVolumeChange = () => {
    const v = playerRef.current?.volume;
    if (typeof v === 'number' && !Number.isNaN(v)) {
      lastVolumeRef.current = v;
      saveVolume(v);
    }
  };

  // 进页即预热当前集
  useEffect(() => {
    if (!videoUrl) return;
    void prefetchUrl(videoUrl, {
      title: videoTitle,
      source: currentSource,
      id: currentId,
    });
  }, [videoUrl, videoTitle, currentSource, currentId]);

  if (loading) {
    return (
      <div className='min-h-[100dvh] bg-black flex flex-col items-center justify-center overflow-hidden overscroll-contain relative'>
        {videoCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={videoCover}
            alt=''
            className='absolute inset-0 w-full h-full object-cover opacity-30 blur-xl scale-110'
          />
        ) : (
          <div className='absolute inset-0 bg-gradient-to-b from-slate-900 to-black' />
        )}
        <div className='relative z-10 text-white text-center px-6 max-w-sm'>
          <div className='aspect-[2/3] w-28 mx-auto mb-5 rounded-xl overflow-hidden border border-white/10 bg-slate-800/80 shadow-2xl'>
            {videoCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={videoCover}
                alt=''
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full animate-pulse bg-slate-700' />
            )}
          </div>
          <p className='font-display text-lg mb-1 line-clamp-2'>
            {videoTitle || '准备播放'}
          </p>
          <p className='text-sm text-slate-400 mb-4'>正在接通最优线路…</p>
          <div className='h-1 w-40 mx-auto rounded-full bg-white/10 overflow-hidden'>
            <div className='h-full w-1/2 bg-gradient-to-r from-teal-400 to-teal-200 animate-pulse' />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-[100dvh] bg-black flex items-center justify-center overflow-hidden overscroll-contain'>
        <div className='text-white text-center'>
          <div className='text-xl font-semibold mb-4 text-red-400'>
            播放失败
          </div>
          <div className='text-base mb-6'>{error}</div>
          <button
            onClick={() => {
              if (videoTitle) {
                window.location.href = `/aggregate?q=${encodeURIComponent(
                  videoTitle
                )}${videoYear ? `&year=${encodeURIComponent(videoYear)}` : ''}`;
              } else {
                window.location.href = '/';
              }
            }}
            className='px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold transition-colors'
          >
            {videoTitle ? '返回选源' : '返回首页'}
          </button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className='min-h-[100dvh] bg-black flex items-center justify-center overflow-hidden overscroll-contain'>
        <div className='text-white text-center'>
          <div className='text-xl font-semibold mb-4'>未找到视频</div>
          <button
            onClick={() => {
              if (videoTitle) {
                window.location.href = `/aggregate?q=${encodeURIComponent(
                  videoTitle
                )}${videoYear ? `&year=${encodeURIComponent(videoYear)}` : ''}`;
              } else {
                window.location.href = '/';
              }
            }}
            className='px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold transition-colors'
          >
            {videoTitle ? '返回选源' : '返回首页'}
          </button>
        </div>
      </div>
    );
  }

  class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context, config, callbacks) {
        // 拦截manifest和level请求
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (response, stats, context) {
            // 如果是m3u8文件，处理内容以移除广告分段
            if (response.data && typeof response.data === 'string') {
              const cuts = countM3U8AdCuts(response.data);
              response.data = filterAdsFromM3U8(response.data);
              if (
                cuts > 0 &&
                (context as any).type === 'manifest' &&
                !adToastShownRef.current
              ) {
                adToastShownRef.current = true;
                try {
                  toast(`本集去掉约 ${cuts} 段广告切入点`);
                } catch {
                  /* ignore */
                }
              }
            }
            return onSuccess(response, stats, context, null);
          };
        }
        // 执行原始load方法
        load(context, config, callbacks);
      };
    }
  }
  const onProviderChange = (provider: MediaProviderAdapter | null) => {
    class extendedHls extends Hls {
      constructor(config: any) {
        // 调用父类构造函数
        // @ts-ignore
        super(config);
      }

      attachMedia(media: HTMLMediaElement): void {
        super.attachMedia(media);

        media.disableRemotePlayback = false;
        media.autoplay = true;
      }
    }
    if (isHLSProvider(provider)) {
      provider.library = extendedHls;
      provider.config = {
        debug: false, // 关闭日志
        enableWorker: true, // WebWorker 解码，降低主线程压力
        lowLatencyMode: true, // 开启低延迟 LL-HLS
        /* 缓冲/内存相关 */
        maxBufferLength: 30, // 前向缓冲最大 30s，过大容易导致高延迟
        backBufferLength: 30, // 仅保留 30s 已播放内容，避免内存占用
        maxBufferSize: 60 * 1000 * 1000, // 约 60MB，超出后触发清理
        /* 自定义loader */
        loader: blockAdEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
      };
    }
  };

  const onSourceChange = () => {
    // 仅在 WebKit（Safari）环境下重建播放器，解决部分资源切换后黑屏或无法播放的问题
    const isWebkit =
      typeof window !== 'undefined' &&
      typeof (window as any).webkitConvertPointFromNodeToPage === 'function';

    if (ignoreSourceChangeRef.current) {
      // 这一次是由我们手动重建引起的，直接忽略
      ignoreSourceChangeRef.current = false;
      return;
    }

    if (isWebkit) {
      // 第一次真实的 sourcechange，仅设置标记，不重建
      if (!hasSourceChangedRef.current) {
        hasSourceChangedRef.current = true;
        return;
      }

      // 第二次（用户真正切换源）开始重建播放器
      // 设置标志，下一次由重建带来的 sourcechange 忽略
      console.log('destory player and rebuild');
      ignoreSourceChangeRef.current = true;
      setPlayerReloadKey((k) => k + 1);
    }
  };

  return (
    <div
      ref={playerContainerRef}
      tabIndex={-1}
      className='bg-black fixed inset-0 overflow-hidden overscroll-contain'
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* 竖屏提示蒙层 */}
      {showOrientationTip && (
        <div className='fixed bottom-16 left-1/2 -translate-x-1/2 z-[190] flex items-center px-4 py-2 rounded bg-black/70 text-white space-x-2 pointer-events-none backdrop-blur-sm'>
          <svg
            className='w-5 h-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 4v16m8-8H4'
            />
          </svg>
          <span className='text-sm'>请横屏观看</span>
        </div>
      )}

      {/* 强制横屏：竖屏时放右下角大按钮，躲开底部手势条 */}
      {isPortrait && (
        <button
          type='button'
          onClick={handleForceLandscape}
          className='fixed z-[120] md:hidden flex items-center gap-1.5 rounded-full bg-teal-600 text-white font-semibold text-sm px-4 py-3 shadow-lg shadow-black/40 active:scale-95'
          style={{
            right: 'max(1rem, env(safe-area-inset-right))',
            bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))',
          }}
          title='全屏横屏观看'
        >
          <svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' aria-hidden>
            <path
              d='M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          横屏
        </button>
      )}

      {/* 换源加载遮罩 */}
      {sourceChanging && (
        <div className='fixed inset-0 bg-black/50 z-[200] flex items-center justify-center'>
          <div className='text-white text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mx-auto mb-2'></div>
            <div className='text-sm'>换源中...</div>
          </div>
        </div>
      )}

      {/* 播放器容器 */}
      <div className='relative w-full h-full'>
      {upNextOpen && (
        <UpNextOverlay
          title={videoTitle}
          episodeLabel={`第 ${currentEpisodeIndex + 2} 集`}
          secondsLeft={upNextSeconds}
          onPlayNow={goNextEpisode}
          onCancel={clearUpNext}
          finished={seriesFinished}
          related={
            seriesFinished
              ? (() => {
                  const next = resolveNextSeason(videoTitle);
                  const root = seriesRootTitle(videoTitle);
                  const links: { label: string; href: string }[] = [];
                  if (next) {
                    links.push({
                      label: next.label,
                      href: `/search?q=${encodeURIComponent(next.nextQuery)}`,
                    });
                  }
                  if (root && root !== videoTitle) {
                    links.push({
                      label: `同系列：${root}`,
                      href: `/search?q=${encodeURIComponent(root)}`,
                    });
                  }
                  links.push({
                    label: `搜索：${videoTitle.slice(0, 16)}`,
                    href: `/search?q=${encodeURIComponent(videoTitle)}`,
                  });
                  links.push({
                    label: '回首页猜你想看',
                    href: '/',
                  });
                  return links;
                })()
              : []
          }
        />
      )}
      {showSkipIntro && !upNextOpen && !hideChromeOverlays && (
        <div className='absolute top-20 right-4 z-[75] flex flex-col items-end gap-2'>
          <button
            type='button'
            onClick={handleSkipIntro}
            className='rounded-full border border-teal-400/40 bg-slate-950/70 backdrop-blur-md px-4 py-2 text-sm text-teal-200 hover:bg-teal-500 hover:text-slate-950 transition-colors shadow-lg'
          >
            跳过片头（{introEndSec}s）
          </button>
          <button
            type='button'
            onClick={handleRememberIntroHere}
            className='rounded-full border border-white/15 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 text-xs text-slate-300 hover:border-teal-400/40 hover:text-teal-200 transition-colors'
            title='把当前进度记为本片片头结束'
          >
            记住此处为片头结束
          </button>
        </div>
      )}
      {showMarkOutro && !showSkipIntro && !upNextOpen && !hideChromeOverlays && (
        <div className='absolute top-20 right-4 z-[75] flex flex-col items-end gap-2'>
          <button
            type='button'
            onClick={handleRememberOutroHere}
            className='rounded-full border border-amber-400/40 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500 hover:text-slate-950 transition-colors shadow-lg'
            title='把当前进度记为本片片尾开始（之后会提前进下一集）'
          >
            记住此处为片尾开始
            {outroStartSec ? `（已记 ${outroStartSec}s）` : ''}
          </button>
        </div>
      )}
      {!upNextOpen && !hideChromeOverlays && (
        <div className='absolute top-20 left-4 z-[75] flex flex-col items-start gap-2 max-w-[min(90vw,16rem)]'>
          <button
            type='button'
            onClick={() => setPlayMoreOpen((v) => !v)}
            className='rounded-full border border-white/15 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 text-xs text-slate-200 hover:border-teal-400/40 hover:text-teal-100 transition-colors'
            title='字幕、书签等工具'
          >
            更多
            {sceneMarks.length > 0 ? ` · ${sceneMarks.length}` : ''}
            {playMoreOpen ? ' ▴' : ' ▾'}
          </button>
          {playMoreOpen && (
            <div className='rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-md p-2.5 w-full shadow-xl space-y-2'>
              <div className='flex flex-wrap gap-1.5'>
                <button
                  type='button'
                  onClick={handleRememberScene}
                  className='rounded-full border border-teal-400/35 bg-slate-900/60 px-3 py-1.5 text-xs text-teal-100 hover:bg-teal-500 hover:text-slate-950 transition-colors'
                  title='收藏当前时间点 · B'
                >
                  收藏此刻
                </button>
                <button
                  type='button'
                  onClick={() => subInputRef.current?.click()}
                  className='rounded-full border border-white/15 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:border-teal-400/40 hover:text-teal-100 transition-colors'
                  title='加载本地 .srt / .ass / .vtt'
                >
                  {localSubLabel
                    ? `字幕·${localSubLabel.slice(0, 8)}`
                    : '本地字幕'}
                </button>
              </div>
              <div className='flex flex-wrap items-center gap-1.5'>
                <span className='text-[10px] text-slate-500 px-1'>字号</span>
                <button
                  type='button'
                  onClick={() => {
                    const next = setSubtitlePrefs({ scale: subScale - 0.1 });
                    setSubScale(next.scale);
                    toast(`字幕 ${Math.round(next.scale * 100)}%`);
                  }}
                  className='rounded-full border border-white/15 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300'
                  title='缩小 ['
                >
                  A−
                </button>
                <button
                  type='button'
                  onClick={() => {
                    const next = setSubtitlePrefs({ scale: subScale + 0.1 });
                    setSubScale(next.scale);
                    toast(`字幕 ${Math.round(next.scale * 100)}%`);
                  }}
                  className='rounded-full border border-white/15 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300'
                  title='放大 ]'
                >
                  A+
                </button>
                <span className='text-[10px] text-slate-500 px-1 ml-1'>
                  偏移
                </span>
                <button
                  type='button'
                  onClick={() => {
                    const next = setSubtitlePrefs({
                      offsetSec: subOffset - 0.5,
                    });
                    setSubOffset(next.offsetSec);
                    toast(`偏移 ${next.offsetSec.toFixed(1)}s`);
                  }}
                  className='rounded-full border border-white/15 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300'
                  title='字幕提前 · ,'
                >
                  −0.5s
                </button>
                <button
                  type='button'
                  onClick={() => {
                    const next = setSubtitlePrefs({
                      offsetSec: subOffset + 0.5,
                    });
                    setSubOffset(next.offsetSec);
                    toast(`偏移 ${next.offsetSec.toFixed(1)}s`);
                  }}
                  className='rounded-full border border-white/15 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300'
                  title='字幕延后 · .'
                >
                  +0.5s
                </button>
                <span className='text-[10px] tabular-nums text-teal-300/80 px-1'>
                  {subOffset.toFixed(1)}s · {Math.round(subScale * 100)}%
                </span>
              </div>
              <input
                ref={subInputRef}
                type='file'
                accept='.srt,.ass,.ssa,.vtt,text/vtt'
                className='hidden'
                onChange={(e) => {
                  void handleLocalSubtitle(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
              {sceneMarks.length > 0 && (
                <div className='border-t border-white/10 pt-1.5 max-h-28 overflow-y-auto'>
                  {sceneMarks.map((b) => (
                    <div
                      key={b.id}
                      className='flex items-center justify-between gap-2 text-[11px] text-teal-100/90 py-0.5'
                    >
                      <button
                        type='button'
                        className='tabular-nums hover:text-teal-300'
                        onClick={() => {
                          try {
                            if (playerRef.current)
                              playerRef.current.currentTime = b.t;
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        {Math.floor(b.t / 60)}:
                        {String(Math.floor(b.t % 60)).padStart(2, '0')}
                      </button>
                      <button
                        type='button'
                        className='text-slate-500 hover:text-red-300'
                        onClick={() => {
                          removeSceneBookmark(b.id);
                          setSceneMarks(
                            getBookmarksForTitle(videoTitleRef.current)
                          );
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <IntroProgressHint
        introEndSec={introEndSec}
        outroStartSec={outroStartSec}
        duration={mediaDuration}
        visible={
          !hideChromeOverlays &&
          !upNextOpen &&
          (introEndSec > 5 || !!outroStartSec)
        }
      />
      {/* 双击左右跳 · 长按 2×（不挡中间控件） */}
      {!upNextOpen && !!videoUrl && (
        <>
          {/* 底部留给控制栏 / 全屏按钮，避免右下角点不到 */}
          <div
            className='absolute top-0 bottom-24 left-0 w-[28%] z-[40] md:hidden'
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const p = playerRef.current;
              if (!p) return;
              p.currentTime = Math.max(0, (p.currentTime || 0) - 10);
              displayShortcutHint('快退 10s', 'left');
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              (e.currentTarget as any)._lp = {
                x: t.clientX,
                y: t.clientY,
                timer: setTimeout(() => {
                  const p = playerRef.current;
                  if (!p) return;
                  (e.currentTarget as any)._boosted = true;
                  (e.currentTarget as any)._prevRate = p.playbackRate || 1;
                  p.playbackRate = 2;
                  displayShortcutHint('2× 倍速', 'up');
                }, 420),
              };
            }}
            onTouchEnd={(e) => {
              const st = (e.currentTarget as any)._lp;
              if (st?.timer) clearTimeout(st.timer);
              if ((e.currentTarget as any)._boosted) {
                const p = playerRef.current;
                if (p)
                  p.playbackRate = (e.currentTarget as any)._prevRate || 1;
                (e.currentTarget as any)._boosted = false;
                displayShortcutHint('恢复倍速', 'down');
              }
            }}
            onTouchCancel={(e) => {
              const st = (e.currentTarget as any)._lp;
              if (st?.timer) clearTimeout(st.timer);
            }}
          />
          <div
            className='absolute top-0 bottom-24 right-0 w-[28%] z-[40] md:hidden'
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const p = playerRef.current;
              if (!p) return;
              const dur = p.duration || Number.POSITIVE_INFINITY;
              p.currentTime = Math.min(
                (p.currentTime || 0) + 10,
                Number.isFinite(dur) ? dur - 0.5 : (p.currentTime || 0) + 10
              );
              displayShortcutHint('快进 10s', 'right');
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              (e.currentTarget as any)._lp = {
                x: t.clientX,
                y: t.clientY,
                timer: setTimeout(() => {
                  const p = playerRef.current;
                  if (!p) return;
                  (e.currentTarget as any)._boosted = true;
                  (e.currentTarget as any)._prevRate = p.playbackRate || 1;
                  p.playbackRate = 2;
                  displayShortcutHint('2× 倍速', 'up');
                }, 420),
              };
            }}
            onTouchEnd={(e) => {
              const st = (e.currentTarget as any)._lp;
              if (st?.timer) clearTimeout(st.timer);
              if ((e.currentTarget as any)._boosted) {
                const p = playerRef.current;
                if (p)
                  p.playbackRate = (e.currentTarget as any)._prevRate || 1;
                (e.currentTarget as any)._boosted = false;
                displayShortcutHint('恢复倍速', 'down');
              }
            }}
            onTouchCancel={(e) => {
              const st = (e.currentTarget as any)._lp;
              if (st?.timer) clearTimeout(st.timer);
            }}
          />
        </>
      )}
      <MediaPlayer
        ref={playerRef}
        className='w-full h-full group'
        src={videoUrl}
        poster={videoCover}
        playsInline
        autoPlay
        volume={lastVolumeRef.current}
        crossOrigin='anonymous'
        controlsDelay={3000}
        key={playerReloadKey}
        onCanPlay={onCanPlay}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        onPause={() => {
          saveCurrentPlayProgress();
          try {
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'paused';
            }
          } catch {
            /* ignore */
          }
          try {
            (window as any).__coupleNestEmit?.(
              'pause',
              playerRef.current?.currentTime
            );
          } catch {
            /* ignore */
          }
        }}
        onPlay={() => {
          try {
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          } catch {
            /* ignore */
          }
          try {
            (window as any).__coupleNestEmit?.(
              'play',
              playerRef.current?.currentTime
            );
          } catch {
            /* ignore */
          }
        }}
        onError={handlePlayerError}
        onProviderChange={onProviderChange}
        onSourceChange={onSourceChange}
        onVolumeChange={handleVolumeChange}
      >
        <MediaProvider />
        <PlayerTopbar
          videoTitle={videoTitle}
          favorited={favorited}
          totalEpisodes={totalEpisodes}
          currentEpisodeIndex={currentEpisodeIndex}
          sourceName={detail?.source_name || ''}
          isFullscreen={isFullscreen}
          onBack={() => {
            if (isFullscreen) {
              playerRef.current?.exitFullscreen();
              return;
            }
            window.history.back();
          }}
          onToggleFavorite={handleToggleFavorite}
          onOpenEpisodes={() => {
            setShowEpisodePanel(true);
            playerContainerRef.current?.focus();
          }}
          onOpenSourcePanel={handleSourcePanelOpen}
        />
        <CoupleNestPanel
          open={coupleOpen}
          onClose={() => setCoupleOpen(false)}
          getPlayback={() => ({
            currentTime: playerRef.current?.currentTime || 0,
            playing: !!playerRef.current?.playing,
          })}
          applyCmd={(action, t) => {
            const p = playerRef.current;
            if (!p) return;
            try {
              if (typeof t === 'number') p.currentTime = t;
              if (action === 'play') p.play?.();
              if (action === 'pause') p.pause?.();
              if (action === 'seek' && typeof t === 'number') p.currentTime = t;
            } catch {
              /* ignore */
            }
          }}
        />
        {!hideChromeOverlays && (
          <button
            type='button'
            onClick={() => setCoupleOpen((v) => !v)}
            className='absolute bottom-24 right-4 z-[84] rounded-full border border-teal-400/40 bg-slate-950/70 backdrop-blur-md px-3 py-2 text-xs text-teal-200 hover:bg-teal-500 hover:text-slate-950 transition-colors shadow-lg flex items-center gap-1.5'
            title='一起看'
          >
            <Users className='h-3.5 w-3.5' />
            一起看
          </button>
        )}
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          slots={{
            googleCastButton: null,
            pipButton: null,
            settingsMenu: null,
            captionButton: null,
            muteButton: null, // 隐藏静音按钮
            volumeSlider: null, // 隐藏音量条
            airPlayButton: null, // 隐藏默认 AirPlay 按钮
            beforeCurrentTime: (
              <>
                {/* 快进 10 秒按钮 - 根据播放器尺寸决定显隐 */}
                {showSkipButtons && (
                  <button
                    className='vds-button mr-2'
                    onClick={() => {
                      if (playerRef.current) {
                        const p = playerRef.current;
                        const newTime = Math.min(
                          (p.currentTime || 0) + 10,
                          p.duration || 0
                        );
                        p.currentTime = newTime;
                      }
                    }}
                    aria-label='Fast Forward 10 Seconds'
                  >
                    <svg
                      className='vds-icon'
                      viewBox='0 0 32 32'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      {/* 双三角快进图标 */}
                      <path d='M6 24l10-8L6 8v16z' fill='currentColor' />
                      <path d='M18 24l10-8-10-8v16z' fill='currentColor' />
                    </svg>
                  </button>
                )}

                {totalEpisodes > 1 && (
                  // 下一集按钮放在时间显示前
                  <button
                    className='vds-button mr-2'
                    onClick={handleNextEpisode}
                    aria-label='Next Episode'
                  >
                    <svg
                      className='vds-icon'
                      viewBox='0 0 32 32'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        d='M6 24l12-8L6 8v16zM22 8v16h3V8h-3z'
                        fill='currentColor'
                      />
                    </svg>
                  </button>
                )}
              </>
            ),
            beforeFullscreenButton: (
              <>
                <button
                  className='vds-button'
                  aria-label={blockAdEnabled ? '关闭去广告' : '开启去广告'}
                  onClick={() => {
                    const newVal = !blockAdEnabled;
                    try {
                      saveCurrentPlayProgress();
                      localStorage.setItem('enable_blockad', String(newVal));
                    } catch (_) {
                      // ignore
                    }
                    window.location.reload();
                  }}
                >
                  <AdBlockIcon enabled={blockAdEnabled} />
                </button>
                <PlaybackRateButton playerRef={playerRef} />
                {/* 手机端藏画中画 / AirPlay，给全屏按钮留触控空间 */}
                <span className='hidden sm:contents'>
                  <PictureInPictureButton playerRef={playerRef} />
                  <AirPlayButton className='vds-button'>
                    <AirPlayIcon className='vds-icon' />
                  </AirPlayButton>
                </span>
                {/* 手机：显式横屏入口，避免右下角全屏被挡 */}
                <button
                  type='button'
                  className='vds-button sm:hidden'
                  aria-label='横屏全屏'
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleForceLandscape();
                  }}
                >
                  <svg
                    className='vds-icon'
                    viewBox='0 0 24 24'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path
                      d='M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                </button>
              </>
            ),
            // 快退 10 秒按钮（根据播放器尺寸决定显隐）
            beforePlayButton: (
              <>
                {showSkipButtons && (
                  <button
                    className='vds-button mr-2'
                    onClick={() => {
                      if (playerRef.current) {
                        const p = playerRef.current;
                        const newTime = Math.max(0, (p.currentTime || 0) - 10);
                        p.currentTime = newTime;
                      }
                    }}
                    aria-label='Rewind 10 Seconds'
                  >
                    <svg
                      className='vds-icon'
                      viewBox='0 0 32 32'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      {/* 双三角快退图标 */}
                      <path d='M26 24l-10-8 10-8v16z' fill='currentColor' />
                      <path d='M14 24l-10-8 10-8v16z' fill='currentColor' />
                    </svg>
                  </button>
                )}
              </>
            ),
          }}
        />

        {/* 选集侧拉面板 */}
        {totalEpisodes > 1 && (
          <div data-episode-panel>
            {/* 遮罩层 */}
            {showEpisodePanel && (
              <div
                className='fixed inset-0 bg-black/50 z-[110]'
                onClick={() => {
                  setShowEpisodePanel(false);
                  playerContainerRef.current?.focus();
                }}
              />
            )}

            {/* 侧拉面板 */}
            <div
              className={`fixed top-0 right-0 h-full w-full mobile-landscape:w-1/2 md:w-80 bg-black/40 backdrop-blur-xl z-[110] transform transition-transform duration-300 ${
                showEpisodePanel ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className='p-6 h-full flex flex-col'>
                <div className='flex items-center justify-between mb-6'>
                  <div className='flex items-center gap-4'>
                    <h3 className='text-white text-xl font-semibold'>
                      选集列表
                    </h3>
                    {/* 倒序小字 */}
                    <span
                      onClick={() => setReverseEpisodeOrder((prev) => !prev)}
                      className={`text-sm cursor-pointer select-none transition-colors ${
                        reverseEpisodeOrder
                          ? 'text-teal-500'
                          : 'text-gray-400 hover:text-gray-500'
                      }`}
                    >
                      倒序
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowEpisodePanel(false);
                      playerContainerRef.current?.focus();
                    }}
                    className='text-gray-400 hover:text-white transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='text-gray-300 text-sm mb-4'>
                  当前: 第 {currentEpisodeIndex + 1} 集 / 共 {totalEpisodes} 集
                </div>

                <div className='flex-1 overflow-y-auto'>
                  <div className='grid grid-cols-4 gap-3'>
                    {(reverseEpisodeOrder
                      ? Array.from(
                          { length: totalEpisodes },
                          (_, i) => i
                        ).reverse()
                      : Array.from({ length: totalEpisodes }, (_, i) => i)
                    ).map((idx) => (
                      <button
                        key={idx}
                        onClick={() => handleEpisodeChange(idx)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          idx === currentEpisodeIndex
                            ? 'bg-teal-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 换源侧拉面板 */}
        <div data-source-panel>
          {/* 遮罩层 */}
          {showSourcePanel && (
            <div
              className='fixed inset-0 bg-black/50 z-[110]'
              onClick={() => {
                setShowSourcePanel(false);
                playerContainerRef.current?.focus();
              }}
            />
          )}

          {/* 侧拉面板 */}
          <div
            className={`fixed top-0 right-0 h-full w-full mobile-landscape:w-1/2 md:w-96 bg-black/40 backdrop-blur-xl z-[110] transform transition-transform duration-300 ${
              showSourcePanel ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className='p-6 h-full flex flex-col'>
              <div className='flex items-center justify-between mb-6'>
                <div>
                  <h3 className='text-white text-xl font-semibold'>播放源</h3>
                  <p className='text-xs text-slate-400 mt-1'>
                    {speedProbing
                      ? '测速中…'
                      : '按首包耗时排序参考 · 越快越好'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSourcePanel(false);
                    playerContainerRef.current?.focus();
                  }}
                  className='text-gray-400 hover:text-white transition-colors'
                >
                  <svg
                    className='w-6 h-6'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>

              {/* 搜索结果（流式边到边画） */}
              <div className='flex-1 overflow-y-auto'>
                {searchLoading && searchResults.length === 0 && (
                  <div className='flex items-center justify-center py-8'>
                    <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400'></div>
                    <span className='text-gray-300 ml-3'>流式聚合中…</span>
                  </div>
                )}

                {searchStreaming && searchResults.length > 0 && (
                  <p className='text-xs text-teal-400/90 px-1 pb-2'>
                    仍有源在返回，列表会继续更新
                  </p>
                )}

                {searchError && (
                  <div className='text-red-400 text-center py-4'>
                    {searchError}
                  </div>
                )}

                {!searchLoading &&
                  !searchStreaming &&
                  !searchError &&
                  searchResults.length === 0 && (
                    <div className='text-gray-400 text-center py-8'>
                      未找到相关视频源
                    </div>
                  )}

                {!searchError && searchResults.length > 0 && (
                  <div className='grid grid-cols-2 gap-4'>
                    {[
                      ...searchResults.filter(
                        (r) =>
                          r.source === currentSource &&
                          String(r.id) === String(currentId)
                      ),
                      ...searchResults.filter(
                        (r) =>
                          !(
                            r.source === currentSource &&
                            String(r.id) === String(currentId)
                          )
                      ),
                    ]
                      .slice()
                      .sort((a, b) => {
                        const pref = getPreferredSource(videoTitle);
                        const sa = scoreSourceQuality({
                          source: a.source,
                          id: a.id,
                          speed: sourceSpeeds[`${a.source}-${a.id}`],
                          preferredSource: pref,
                          episodeCount: a.episodes?.length || 0,
                        });
                        const sb = scoreSourceQuality({
                          source: b.source,
                          id: b.id,
                          speed: sourceSpeeds[`${b.source}-${b.id}`],
                          preferredSource: pref,
                          episodeCount: b.episodes?.length || 0,
                        });
                        return sb - sa;
                      })
                      .map((result) => {
                      const isCurrentSource =
                        result.source === currentSource &&
                        String(result.id) === String(currentId);
                      const speedKey = `${result.source}-${result.id}`;
                      const speed = sourceSpeeds[speedKey];
                      const qScore = scoreSourceQuality({
                        source: result.source,
                        id: result.id,
                        speed,
                        preferredSource: getPreferredSource(videoTitle),
                        episodeCount: result.episodes?.length || 0,
                      });
                      return (
                        <div
                          key={speedKey}
                          className={`rounded-xl transition-colors border-2 overflow-hidden ${
                            isCurrentSource
                              ? 'border-teal-400 bg-teal-500/15 cursor-not-allowed opacity-70'
                              : 'border-transparent bg-white/5 hover:bg-white/10 cursor-pointer'
                          }`}
                          onClick={() =>
                            !isCurrentSource &&
                            handleSourceChange(
                              result.source,
                              result.id,
                              result.title
                            )
                          }
                        >
                          <div className='aspect-[2/3] overflow-hidden flex items-center justify-center p-1 relative'>
                            <img
                              src={result.poster}
                              alt={result.title}
                              className='w-full h-full object-cover rounded-lg'
                              referrerPolicy='no-referrer'
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  'none';
                              }}
                            />

                            {result.episodes && (
                              <div className='absolute top-2 right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center'>
                                <span className='text-white text-xs font-bold'>
                                  {result.episodes.length}
                                </span>
                              </div>
                            )}

                            <div
                              className={`absolute bottom-2 left-2 right-2 text-[10px] text-center rounded-md border px-1 py-0.5 backdrop-blur-sm ${
                                speed
                                  ? speedTone(speed.ms, speed.ok)
                                  : qualityTone(qScore)
                              }`}
                            >
                              {speed
                                ? `${formatSpeedMs(speed.ms, speed.ok)} · ${qualityLabel(qScore)}`
                                : `质量 ${qualityLabel(qScore)}`}
                            </div>

                            {isCurrentSource && (
                              <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                                <div className='bg-teal-500 text-slate-950 text-xs font-semibold px-3 py-1 rounded-lg shadow-lg'>
                                  当前播放
                                </div>
                              </div>
                            )}
                          </div>

                          <div className='p-2 bg-transparent text-center'>
                            <h4 className='text-white font-medium text-sm line-clamp-2 mb-2 leading-tight'>
                              {result.title}
                            </h4>
                            <div className='text-gray-400 text-xs space-y-1'>
                              <div className='inline-block border border-gray-500/60 rounded px-2 py-[1px]'>
                                {result.source_name}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 快捷键提示 */}
        <div
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 transition-opacity duration-300 ${
            showShortcutHint ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className='bg-black/80 backdrop-blur-sm rounded p-4 flex items-center space-x-3'>
            <svg
              className='w-6 h-6 text-white'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              {shortcutDirection === 'left' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M15 19l-7-7 7-7'
                ></path>
              )}
              {shortcutDirection === 'right' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                ></path>
              )}
              {shortcutDirection === 'up' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M5 15l7-7 7 7'
                ></path>
              )}
              {shortcutDirection === 'down' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M19 9l-7 7-7-7'
                ></path>
              )}
              {shortcutDirection === 'play' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M8 5v14l11-7L8 5z'
                ></path>
              )}
              {shortcutDirection === 'pause' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M6 6h4v12H6zm8 0h4v12h-4z'
                ></path>
              )}
              {shortcutDirection === 'error' && (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M6 18L18 6M6 6l12 12'
                ></path>
              )}
            </svg>
            <span className='text-white font-medium'>{shortcutText}</span>
          </div>
        </div>
      </MediaPlayer>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayPageClient />
    </Suspense>
  );
}
