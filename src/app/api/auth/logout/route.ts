import { NextResponse } from 'next/server';

import { clearSessionCookie } from '@/lib/authSession';

export const runtime = 'edge';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearSessionCookie());
  return res;
}
