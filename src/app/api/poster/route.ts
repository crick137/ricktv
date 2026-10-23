import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/** 允许代理的图床（防 SSRF） */
const ALLOWED_HOST =
  /^(?:[\w-]+\.)*(?:doubanio\.com|douban\.com|alicdn\.com|iqiyipic\.com|hdslb\.com|ykimg\.com|qhimg\.com|pstatp\.com|byteimg\.com|mtdp\.net|media-amazon\.com|tmdb\.org)$/i;

const DOUBAN_MIRRORS = ['img1', 'img2', 'img3', 'img9'];

const REFERERS = [
  'https://movie.douban.com/',
  'https://www.douban.com/',
  'https://m.douban.com/',
];

function doubanMirrorUrls(url: string): string[] {
  try {
    const u = new URL(url);
    if (!/doubanio\.com$/i.test(u.hostname)) return [url];
    const out = new Set<string>([url]);
    for (const m of DOUBAN_MIRRORS) {
      const next = new URL(url);
      next.hostname = `${m}.doubanio.com`;
      out.add(next.toString());
    }
    return Array.from(out);
  } catch {
    return [url];
  }
}

async function fetchImage(
  url: string,
  referer: string
): Promise<Response | null> {
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: referer,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!upstream.ok || !upstream.body) return null;
    const ct = upstream.headers.get('content-type') || '';
    if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
      return null;
    }
    return upstream;
  } catch {
    return null;
  }
}

/**
 * 豆瓣等图床校验 Referer，浏览器直连常 418。
 * GET /api/poster?url=<encoded https url>
 * 失败时轮换 doubanio 镜像 + Referer。
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (
    !/^https?:$/i.test(target.protocol) ||
    !ALLOWED_HOST.test(target.hostname)
  ) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 403 });
  }

  const candidates = doubanMirrorUrls(target.toString());

  for (const url of candidates) {
    for (const referer of REFERERS) {
      const upstream = await fetchImage(url, referer);
      if (!upstream || !upstream.body) continue;

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          'X-Poster-Via': new URL(url).hostname,
        },
      });
    }
  }

  return new NextResponse(null, { status: 502 });
}
