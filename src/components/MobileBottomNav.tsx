'use client';

import {
  Home,
  LayoutGrid,
  Search,
  Settings,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MobileBottomNav = ({ activePath }: { activePath?: string }) => {
  const pathname = usePathname();
  const currentActive = activePath ?? pathname;

  const navItems = [
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: '/search' },
    { icon: LayoutGrid, label: '发现', href: '/discover' },
    { icon: Smartphone, label: '短剧', href: '/duanju' },
    { icon: Settings, label: '设置', href: '/settings' },
  ] as const;

  const isActive = (href: string) => {
    const decoded = decodeURIComponent(currentActive);

    if (href === '/discover') {
      return (
        decoded.startsWith('/discover') ||
        decoded.startsWith('/douban')
      );
    }

    if (href === '/settings') {
      return decoded.startsWith('/settings');
    }

    if (href === '/duanju') {
      return decoded.startsWith('/duanju');
    }

    if (href === '/search') {
      return decoded.startsWith('/search');
    }

    return decoded === href || decoded.split('?')[0] === href;
  };

  return (
    <nav
      className='md:hidden fixed bottom-0 left-0 right-0 z-50 px-2.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1'
      aria-label='主导航'
    >
      <div className='rt-glass rounded-2xl border border-slate-200/30 dark:border-white/8 shadow-lg shadow-slate-900/10 dark:shadow-black/40'>
        <div className='flex items-stretch justify-around px-0.5 py-1'>
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center justify-center min-w-0 px-1 py-1.5 rounded-xl transition-all duration-300 ${
                  active
                    ? 'text-teal-700 dark:text-teal-300 bg-teal-500/12'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {active && (
                  <span
                    className='absolute top-0.5 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-sm bg-teal-500'
                    aria-hidden
                  />
                )}
                <Icon
                  className={`h-4 w-4 mb-0.5 transition-transform duration-300 ${
                    active ? 'scale-105' : ''
                  }`}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className='text-[9.5px] leading-tight font-medium tracking-wide truncate max-w-full'>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
