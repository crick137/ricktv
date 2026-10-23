/**
 * CMS 常返回相对路径海报（如 upload/vod/...），需拼成绝对 URL
 * 供 next/image 使用；无法解析则返回空串，由 UI 降级。
 */

export function resolvePosterUrl(
  pic: string | undefined | null,
  baseHint?: string
): string {
  const raw = (pic || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('/')) {
    const origin = originFrom(baseHint);
    return origin ? `${origin}${raw}` : '';
  }
  const origin = originFrom(baseHint);
  if (!origin) return '';
  return `${origin}/${raw.replace(/^\.\//, '')}`;
}

function originFrom(hint?: string): string {
  if (!hint) return '';
  try {
    const u = new URL(hint);
    return u.origin;
  } catch {
    return '';
  }
}

/** 客户端：非法相对路径不要丢给 next/image */
export function isUsableImageSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  if (src.startsWith('/') || src.startsWith('data:')) return true;
  if (/^https?:\/\//i.test(src)) return true;
  return false;
}

const DOUBAN_MIRRORS = ['img1', 'img2', 'img3', 'img9'];

/**
 * 豆瓣图裂时换镜像主机；非豆瓣原样返回空（交给上层降级）
 */
export function nextDoubanMirror(url: string): string {
  try {
    const u = new URL(url);
    if (!/doubanio\.com$/i.test(u.hostname)) return '';
    const m = u.hostname.match(/^img(\d+)\./i);
    const cur = m ? `img${m[1]}` : '';
    const idx = DOUBAN_MIRRORS.indexOf(cur);
    const next = DOUBAN_MIRRORS[(idx + 1) % DOUBAN_MIRRORS.length];
    if (next === cur) return '';
    u.hostname = `${next}.doubanio.com`;
    return u.toString();
  } catch {
    return '';
  }
}

/** 从 /api/poster?url= 解出原始地址 */
export function unwrapPosterProxy(src: string): string {
  if (!src.startsWith('/api/poster')) return src;
  try {
    const q = src.split('?')[1] || '';
    return new URLSearchParams(q).get('url') || '';
  } catch {
    return '';
  }
}
