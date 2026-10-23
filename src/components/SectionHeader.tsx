import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  title: string;
  href?: string;
  hrefLabel?: string;
  action?: ReactNode;
  eyebrow?: string;
};

export default function SectionHeader({
  title,
  href,
  hrefLabel = '查看更多',
  action,
  eyebrow,
}: Props) {
  return (
    <div className='mb-5 flex items-end justify-between gap-3'>
      <div className='min-w-0'>
        {eyebrow && <p className='rt-eyebrow mb-1.5'>{eyebrow}</p>}
        <h2 className='font-display text-[1.35rem] sm:text-[1.65rem] tracking-[-0.02em] text-slate-900 dark:text-slate-50 leading-tight'>
          <span className='relative inline-block pb-1.5'>
            {title}
            <span
              className='absolute bottom-0 left-0 h-[2px] w-9 rounded-sm bg-gradient-to-r from-teal-500 to-transparent'
              aria-hidden
            />
          </span>
        </h2>
      </div>
      {action}
      {href && !action && (
        <Link
          href={href}
          className='group flex items-center shrink-0 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-300 transition-colors'
        >
          {hrefLabel}
          <ChevronRight className='w-4 h-4 ml-0.5 transition-transform duration-300 group-hover:translate-x-0.5' />
        </Link>
      )}
    </div>
  );
}
