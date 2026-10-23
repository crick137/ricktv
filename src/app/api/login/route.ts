/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { attachSession } from '@/lib/authSession';
import { db } from '@/lib/db';

export const runtime = 'edge';

const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as string | undefined) ||
  'localstorage';

export async function POST(req: NextRequest) {
  try {
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.PASSWORD;

      if (!envPassword) {
        const res = NextResponse.json({ ok: true, open: true });
        return attachSession(res, 'guest');
      }

      const { password } = await req.json();
      if (typeof password !== 'string') {
        return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return NextResponse.json(
          { ok: false, error: '密码错误' },
          { status: 401 }
        );
      }

      const res = NextResponse.json({ ok: true });
      return attachSession(res, 'guest');
    }

    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    try {
      const pass = await db.verifyUser(username, password);
      if (!pass) {
        return NextResponse.json(
          { error: '用户名或密码错误' },
          { status: 401 }
        );
      }

      const res = NextResponse.json({ ok: true });
      return attachSession(res, username);
    } catch (err) {
      console.error('数据库验证失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
