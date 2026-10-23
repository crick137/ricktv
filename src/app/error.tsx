'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className='min-h-[60vh] flex items-center justify-center px-4'>
      <div className='w-full max-w-md rt-glass rounded-2xl p-6 text-center shadow-lg shadow-teal-950/10'>
        <p className='text-xs uppercase tracking-[0.2em] text-teal-600/80 dark:text-teal-400/70 mb-2'>
          something broke
        </p>
        <h2 className='font-display text-xl font-bold text-slate-900 dark:text-white mb-2'>
          页面出了点问题
        </h2>
        <p className='text-sm text-slate-500 dark:text-slate-400 mb-5 break-words'>
          {error.message || '未知错误'}
        </p>
        <button
          type='button'
          onClick={reset}
          className='w-full rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-4 py-3 transition-colors'
        >
          再试一次
        </button>
      </div>
    </div>
  );
}
