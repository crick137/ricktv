import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * 服务端探测播放地址首包耗时（绕过浏览器 CORS）。
 * GET /api/speed?url=<encoded>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'invalid url' }, { status: 400 });
  }

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Range: 'bytes=0-2047',
        Accept: '*/*',
      },
    });
    clearTimeout(timer);
    // 读一点 body，避免只拿到 TTFB 误判
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore */
    }
    const ms = Date.now() - started;
    const ok = res.ok || res.status === 206;
    return NextResponse.json({ ok, ms, status: res.status });
  } catch {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - started,
      status: 0,
    });
  }
}
