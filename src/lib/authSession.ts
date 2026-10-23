import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'ricktv1_session';
const SESSION_DAYS = 7;

function storageType() {
  return (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE as string | undefined) ||
    'localstorage'
  );
}

/** 未配置密码且 localstorage 模式 → 开放站点 */
export function authRequired(): boolean {
  if (storageType() === 'localstorage') {
    return Boolean(process.env.PASSWORD);
  }
  return true;
}

function getSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.PASSWORD ||
    process.env.PROXY_SECRET ||
    'ricktv1-dev-secret'
  );
}

function b64url(buf: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buf === 'string') {
    bytes = new TextEncoder().encode(buf);
  } else if (buf instanceof Uint8Array) {
    bytes = buf;
  } else {
    bytes = new Uint8Array(buf);
  }
  let s = '';
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );
  return b64url(sig);
}

export type SessionPayload = {
  u: string;
  exp: number;
};

export async function createSessionToken(
  username: string
): Promise<string> {
  const payload: SessionPayload = {
    u: username || 'guest',
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = await hmacSign(body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = await hmacSign(body);
  if (expect !== sig) return null;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 0,
  };
}

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** 需要登录时返回 401 Response；否则返回 null 放行 */
export async function assertAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  if (!authRequired()) return null;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  return null;
}

export async function attachSession(
  res: NextResponse,
  username: string
): Promise<NextResponse> {
  const token = await createSessionToken(username);
  const opt = sessionCookieOptions(token);
  res.cookies.set(opt);
  return res;
}
