'use client';

import {
  BookOpen,
  Clover,
  Film,
  FlaskConical,
  Ghost,
  Globe2,
  LayoutGrid,
  MessageCircleHeart,
  MountainSnow,
  Smartphone,
  Star,
  Swords,
  Tv,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { DOUBAN_CATEGORIES } from '@/lib/navCategories';

import PageLayout from '@/components/PageLayout';

const ICON_MAP: Record<string, LucideIcon> = {
  film: Film,
  tv: Tv,
  star: Star,
  clover: Clover,
  swords: Swords,
  heart: MessageCircleHeart,
  snow: MountainSnow,
  mask: VenetianMask,
  book: BookOpen,
  globe: Globe2,
  flask: FlaskConical,
  ghost: Ghost,
  phone: Smartphone,
};

export default function DiscoverPage() {
  return (
    <PageLayout activePath='/discover'>
      <div className='px-4 sm:px-10 py-5 sm:py-8 pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <div className='mb-6'>
          <p className='rt-eyebrow mb-2'>discover</p>
          <h1 className='font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50'>
            发现
          </h1>
          <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
            与电脑侧栏相同的全部分类
          </p>
        </div>

        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3'>
          {DOUBAN_CATEGORIES.map((c) => {
            const Icon = ICON_MAP[c.icon] || LayoutGrid;
            return (
              <Link
                key={c.href + c.label}
                href={c.href}
                className='rt-glass rounded-2xl px-3 py-4 flex flex-col items-center justify-center gap-2 text-center border border-transparent hover:border-teal-500/35 hover:bg-teal-500/10 transition-colors active:scale-[0.98]'
              >
                <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/12 text-teal-700 dark:text-teal-300'>
                  <Icon className='h-5 w-5' strokeWidth={1.75} />
                </span>
                <span className='text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight'>
                  {c.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}
