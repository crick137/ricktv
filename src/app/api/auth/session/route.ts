import { NextRequest, NextResponse } from 'next/server';

import {
  authRequired,
  getSessionFromRequest,
} from '@/lib/authSession';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!authRequired()) {
    return NextResponse.json({ ok: true, open: true, user: 'guest' });
  }
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user: session.u });
}
