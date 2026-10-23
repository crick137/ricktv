export default function Loading() {
  return (
    <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4'>
      <div className='h-9 w-9 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin' />
      <p className='font-display text-sm tracking-wide text-slate-500 dark:text-slate-400'>
        Rick&apos;s Nest
      </p>
    </div>
  );
}
