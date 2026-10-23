'use client';

import { useEffect, useState } from 'react';

/** 轻量安装提示：可关闭，记住 14 天 */
export default function PwaInstallHint() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(
    null
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const until = Number(localStorage.getItem('ricktv1-pwa-hide-until') || 0);
      if (until > Date.now()) return;
      if (window.matchMedia('(display-mode: standalone)').matches) return;
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & {
        prompt: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      setDeferred({
        prompt: async () => {
          await ev.prompt();
        },
      });
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (!show || !deferred) return null;

  return (
    <div className='fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,22rem)]'>
      <div className='rt-glass rounded-2xl border border-teal-500/30 px-4 py-3 shadow-lg flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium text-slate-800 dark:text-slate-100'>
            安装 ricktv
          </p>
          <p className='text-xs text-slate-500'>主屏幕打开 · 更像 App</p>
        </div>
        <button
          type='button'
          className='text-sm px-3 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-semibold'
          onClick={async () => {
            try {
              await deferred.prompt();
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          安装
        </button>
        <button
          type='button'
          className='text-xs text-slate-400 hover:text-slate-600'
          onClick={() => {
            try {
              localStorage.setItem(
                'ricktv1-pwa-hide-until',
                String(Date.now() + 14 * 86400000)
              );
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          稍后
        </button>
      </div>
    </div>
  );
}
