/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { siteName } = useSite();

  const shouldAskUsername =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE !== 'localstorage';

  const enableRegister =
    typeof window !== 'undefined' &&
    Boolean((window as any).RUNTIME_CONFIG?.ENABLE_REGISTER);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('password');
          if (shouldAskUsername) {
            localStorage.setItem('username', username);
          } else {
            localStorage.removeItem('username');
          }
        }

        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else if (res.status === 401) {
        setError('密码错误');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!password || !username) return;

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('password');
          localStorage.setItem('username', username);
        }
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-md rounded-3xl rt-glass p-8 sm:p-10 shadow-xl shadow-slate-900/10'>
        <p className='rt-eyebrow text-center mb-2'>welcome</p>
        <h1 className='font-display text-teal-700 dark:text-teal-300 tracking-tight text-center text-3xl font-bold mb-8'>
          {siteName}
        </h1>
        <form onSubmit={handleSubmit} className='space-y-5'>
          {shouldAskUsername && (
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <input
                id='username'
                type='text'
                autoComplete='username'
                className='block w-full rounded-xl border border-slate-200/60 dark:border-white/10 py-3 px-4 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/40 focus:outline-none sm:text-base bg-white/50 dark:bg-slate-900/50'
                placeholder='输入用户名'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor='password' className='sr-only'>
              密码
            </label>
            <input
              id='password'
              type='password'
              autoComplete='current-password'
              className='block w-full rounded-xl border border-slate-200/60 dark:border-white/10 py-3 px-4 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/40 focus:outline-none sm:text-base bg-white/50 dark:bg-slate-900/50'
              placeholder='输入访问密码'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
          )}

          {shouldAskUsername && enableRegister ? (
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={handleRegister}
                disabled={!password || !username || loading}
                className='flex-1 inline-flex justify-center rounded-xl border border-teal-500/40 py-3 text-base font-semibold text-teal-700 dark:text-teal-300 transition-colors hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? '注册中…' : '注册'}
              </button>
              <button
                type='submit'
                disabled={
                  !password || loading || (shouldAskUsername && !username)
                }
                className='flex-1 inline-flex justify-center rounded-xl bg-teal-600 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950'
              >
                {loading ? '登录中…' : '登录'}
              </button>
            </div>
          ) : (
            <button
              type='submit'
              disabled={
                !password || loading || (shouldAskUsername && !username)
              }
              className='inline-flex w-full justify-center rounded-xl bg-teal-600 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950'
            >
              {loading ? '登录中…' : '登录'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageClient />
    </Suspense>
  );
}
