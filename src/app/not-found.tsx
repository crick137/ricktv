import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='min-h-[70vh] flex flex-col items-center justify-center px-6 text-center'>
      <p className='rt-eyebrow mb-3'>404</p>
      <h1 className='font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-3'>
        这页不在 Nest 里
      </h1>
      <p className='text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm'>
        链接可能失效了，或者内容已经下架。回首页继续逛，或直接搜索片名。
      </p>
      <div className='flex flex-wrap items-center justify-center gap-3'>
        <Link
          href='/'
          className='inline-flex items-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 dark:bg-teal-500 dark:text-slate-950'
        >
          回首页
        </Link>
        <Link
          href='/search'
          className='inline-flex items-center rounded-xl border border-teal-500/40 px-5 py-2.5 text-sm font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/10'
        >
          去搜索
        </Link>
      </div>
    </div>
  );
}
