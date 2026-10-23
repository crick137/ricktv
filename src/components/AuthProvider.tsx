'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/ThemeToggle';

import { useSite } from './SiteProvider';

interface Props {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { siteName } = useSite();

  const authenticate = useCallback(async () => {
    if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
      setIsAuthenticated(true);
      return;
    }

    try {
      localStorage.removeItem('password');
    } catch {
      /* ignore */
    }

    const fullPath =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : pathname;

    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('认证失败');
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      try {
        localStorage.removeItem('password');
        localStorage.removeItem('username');
      } catch {
        /* ignore */
      }
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    authenticate();
  }, [pathname, authenticate]);

  if (!isAuthenticated) {
    return (
      <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
        <div className='absolute top-4 right-4'>
          <ThemeToggle />
        </div>
        <div className='relative z-10 w-full max-w-md rounded-3xl rt-glass p-8 sm:p-10 shadow-xl shadow-slate-900/10'>
          <p className='rt-eyebrow text-center mb-2'>ricktv</p>
          <h1 className='font-display text-teal-700 dark:text-teal-300 tracking-tight text-center text-3xl font-bold mb-8'>
            {siteName}
          </h1>
          <div className='flex justify-center my-10'>
            <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500' />
          </div>
          <p className='text-slate-600 dark:text-slate-300 font-medium text-sm text-center'>
            正在验证身份…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
