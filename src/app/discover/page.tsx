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
import { useMemo, useState } from 'react';

import { DISCOVER_SECTIONS } from '@/lib/navCategories';

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
  const [sectionId, setSectionId] = useState(DISCOVER_SECTIONS[0].id);

  const section = useMemo(
    () =>
      DISCOVER_SECTIONS.find((s) => s.id === sectionId) ?? DISCOVER_SECTIONS[0],
    [sectionId]
  );

  return (
    <PageLayout activePath='/discover'>
      <div className='px-4 sm:px-10 py-5 sm:py-8 pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <div className='mb-5'>
          <p className='rt-eyebrow mb-2'>discover</p>
          <h1 className='font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50'>
            发现
          </h1>
          <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
            先选片种，再进题材 / 地区
          </p>
        </div>

        {/* 一级：片种 */}
        <div className='sticky top-0 z-10 -mx-4 px-4 sm:-mx-10 sm:px-10 py-2 mb-4 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md'>
          <div
            className='flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            role='tablist'
            aria-label='片种'
          >
            {DISCOVER_SECTIONS.map((s) => {
              const Icon = ICON_MAP[s.icon] || LayoutGrid;
              const active = s.id === sectionId;
              return (
                <button
                  key={s.id}
                  type='button'
                  role='tab'
                  aria-selected={active}
                  onClick={() => setSectionId(s.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-teal-500 text-white shadow-sm shadow-teal-900/20'
                      : 'rt-glass text-slate-600 dark:text-slate-300 hover:bg-teal-500/10'
                  }`}
                >
                  <Icon className='h-3.5 w-3.5' strokeWidth={active ? 2.25 : 1.75} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 二级：题材 / 入口 */}
        <div className='mb-3 flex items-baseline justify-between gap-2'>
          <h2 className='text-sm font-medium text-slate-500 dark:text-slate-400'>
            {section.label}
          </h2>
          <span className='text-xs text-slate-400 dark:text-slate-500'>
            {section.items.length} 个入口
          </span>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3'>
          {section.items.map((c) => {
            const Icon = ICON_MAP[c.icon] || LayoutGrid;
            return (
              <Link
                key={c.href + c.label}
                href={c.href}
                className='rt-glass rounded-2xl px-3 py-4 flex items-center gap-3 border border-transparent hover:border-teal-500/35 hover:bg-teal-500/10 transition-colors active:scale-[0.98]'
              >
                <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/12 text-teal-700 dark:text-teal-300'>
                  <Icon className='h-5 w-5' strokeWidth={1.75} />
                </span>
                <span className='text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight'>
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
