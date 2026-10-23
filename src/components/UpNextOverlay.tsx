'use client';

type RelatedLink = {
  label: string;
  href: string;
};

type Props = {
  title: string;
  episodeLabel: string;
  secondsLeft: number;
  onPlayNow: () => void;
  onCancel: () => void;
  /** 最后一集播完 */
  finished?: boolean;
  related?: RelatedLink[];
};

export default function UpNextOverlay({
  title,
  episodeLabel,
  secondsLeft,
  onPlayNow,
  onCancel,
  finished = false,
  related = [],
}: Props) {
  if (finished) {
    return (
      <div className='absolute inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-4 animate-fade-in'>
        <div className='w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-teal-950/40 p-5 sm:p-6'>
          <p className='text-xs uppercase tracking-[0.2em] text-teal-400/80 mb-2'>
            Finished
          </p>
          <h3 className='font-display text-xl text-white leading-snug mb-1'>
            本剧看完了
          </h3>
          <p className='text-sm text-slate-400 line-clamp-2 mb-5'>{title}</p>
          {related.length > 0 && (
            <div className='flex flex-col gap-2 mb-5'>
              {related.map((r) => (
                <a
                  key={r.href}
                  href={r.href}
                  className='rounded-xl border border-teal-400/30 bg-teal-500/10 px-4 py-2.5 text-sm text-teal-100 hover:bg-teal-500/20 transition-colors'
                >
                  {r.label}
                </a>
              ))}
            </div>
          )}
          <button
            type='button'
            onClick={onCancel}
            className='w-full rounded-xl border border-white/15 px-4 py-3 text-slate-300 hover:bg-white/5 transition-colors'
          >
            关掉
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='absolute inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-4 animate-fade-in'>
      <div className='w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-teal-950/40 p-5 sm:p-6'>
        <p className='text-xs uppercase tracking-[0.2em] text-teal-400/80 mb-2'>
          Up Next
        </p>
        <h3 className='font-display text-xl text-white leading-snug mb-1'>
          {episodeLabel}
        </h3>
        <p className='text-sm text-slate-400 line-clamp-2 mb-5'>{title}</p>
        <div className='h-1 rounded-full bg-white/10 overflow-hidden mb-5'>
          <div
            className='h-full bg-gradient-to-r from-teal-400 to-teal-300 transition-all duration-1000 linear'
            style={{ width: `${Math.max(0, (secondsLeft / 8) * 100)}%` }}
          />
        </div>
        <div className='flex gap-3'>
          <button
            type='button'
            onClick={onPlayNow}
            className='flex-1 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold py-3 transition-colors'
          >
            立即播放（{secondsLeft}s）
          </button>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-xl border border-white/15 px-4 text-slate-300 hover:bg-white/5 transition-colors'
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
