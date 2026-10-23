'use client';

import Link from 'next/link';

import { LogoutButton } from './LogoutButton';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';

const MobileHeader = () => {
  const { siteName } = useSite();
  return (
    <header className='md:hidden sticky top-0 z-40 w-full rt-glass border-b border-slate-200/25 dark:border-white/5'>
      <div className='h-12 flex items-center justify-center gap-2.5'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src='/logo.png'
          alt=''
          className='h-7 w-7 rounded-xl shadow-sm shadow-teal-900/15'
        />
        <Link
          href='/'
          className='font-display text-[1.2rem] font-bold tracking-tight text-teal-700 dark:text-teal-300 hover:opacity-85 transition-opacity'
        >
          {siteName}
        </Link>
      </div>
      <div className='absolute top-1/2 right-3.5 -translate-y-1/2 flex items-center gap-1.5'>
        <LogoutButton />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default MobileHeader;
