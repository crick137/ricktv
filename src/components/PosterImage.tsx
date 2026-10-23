'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  isUsableImageSrc,
  nextDoubanMirror,
  unwrapPosterProxy,
} from '@/lib/posterUrl';

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
};

/** 需带 Referer 才能出图的图床 → 走本站代理 */
function needsProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /doubanio\.com$|douban\.com$/i.test(host);
  } catch {
    return false;
  }
}

function toProxy(url: string): string {
  return `/api/poster?url=${encodeURIComponent(url)}`;
}

function toDisplaySrc(src: string): string {
  if (!src) return '';
  if (!isUsableImageSrc(src)) return '';
  if (src.startsWith('/') || src.startsWith('data:')) return src;
  if (needsProxy(src)) return toProxy(src);
  return src;
}

function Fallback({
  alt,
  className,
  fill,
  width,
  height,
}: {
  alt: string;
  className: string;
  fill?: boolean;
  width?: number;
  height?: number;
}) {
  const letter = (alt || '?').trim().charAt(0) || '?';
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 text-teal-300/90 font-display text-3xl sm:text-4xl select-none ${className}`}
      style={fill ? { position: 'absolute', inset: 0 } : { width, height }}
      aria-label={alt}
    >
      {letter}
    </div>
  );
}

/**
 * 海报：豆瓣等走 /api/poster；失败换镜像再试，再败则首字降级。
 */
export default function PosterImage({
  src,
  alt,
  className = '',
  fill,
  width,
  height,
  priority,
  sizes,
}: Props) {
  const initial = useMemo(() => toDisplaySrc(src), [src]);
  const [displaySrc, setDisplaySrc] = useState(initial);
  const [failed, setFailed] = useState(!initial);
  const triedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const next = toDisplaySrc(src);
    triedRef.current = new Set(next ? [next] : []);
    setDisplaySrc(next);
    setFailed(!next);
  }, [src]);

  const handleError = () => {
    const raw = unwrapPosterProxy(displaySrc) || displaySrc;
    const mirror = nextDoubanMirror(raw);
    if (mirror) {
      const proxied = toProxy(mirror);
      if (!triedRef.current.has(proxied)) {
        triedRef.current.add(proxied);
        setDisplaySrc(proxied);
        return;
      }
    }
    setFailed(true);
  };

  if (failed || !displaySrc) {
    return (
      <Fallback
        alt={alt}
        className={className}
        fill={fill}
        width={width}
        height={height}
      />
    );
  }

  const isRemote = /^https?:\/\//i.test(displaySrc);

  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      referrerPolicy='no-referrer'
      priority={priority}
      sizes={sizes}
      unoptimized={isRemote || displaySrc.startsWith('/api/')}
      onError={handleError}
    />
  );
}
