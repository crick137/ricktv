'use client';

/**
 * 片头 / 片尾区间在进度条上方的着色提示
 */
export default function IntroProgressHint({
  introEndSec,
  outroStartSec,
  duration,
  visible,
}: {
  introEndSec: number;
  outroStartSec?: number | null;
  duration: number;
  visible: boolean;
}) {
  if (!visible || !duration || duration <= 0) return null;
  const introPct =
    introEndSec > 0 ? Math.min(100, (introEndSec / duration) * 100) : 0;
  const outroPct =
    outroStartSec && outroStartSec > 0
      ? Math.min(100, (outroStartSec / duration) * 100)
      : null;

  if (introPct < 0.5 && outroPct == null) return null;

  return (
    <div
      className='pointer-events-none absolute left-0 right-0 bottom-[3.25rem] sm:bottom-[3.75rem] z-[70] px-3 sm:px-4 opacity-90'
      aria-hidden
    >
      <div className='relative h-1 w-full rounded-full bg-white/10 overflow-hidden'>
        {introPct >= 0.5 && (
          <>
            <div
              className='absolute inset-y-0 left-0 bg-gradient-to-r from-teal-400/80 to-teal-300/40'
              style={{ width: `${introPct}%` }}
            />
            <div
              className='absolute top-1/2 -translate-y-1/2 h-2.5 w-0.5 bg-teal-200 shadow-[0_0_6px_rgba(45,212,191,0.8)]'
              style={{ left: `calc(${introPct}% - 1px)` }}
            />
          </>
        )}
        {outroPct != null && (
          <>
            <div
              className='absolute inset-y-0 right-0 bg-gradient-to-l from-amber-400/70 to-amber-300/30'
              style={{ width: `${Math.max(0, 100 - outroPct)}%` }}
            />
            <div
              className='absolute top-1/2 -translate-y-1/2 h-2.5 w-0.5 bg-amber-200 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
              style={{ left: `calc(${outroPct}% - 1px)` }}
            />
          </>
        )}
      </div>
      <p className='text-[10px] text-teal-200/80 mt-1 tabular-nums flex gap-3'>
        {introPct >= 0.5 && <span>片头至 {Math.round(introEndSec)}s</span>}
        {outroPct != null && (
          <span className='text-amber-200/80'>
            片尾自 {Math.round(outroStartSec!)}s
          </span>
        )}
      </p>
    </div>
  );
}
