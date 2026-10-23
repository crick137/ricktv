import { Link as LinkIcon, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import PosterImage from '@/components/PosterImage';

interface DemoCardProps {
  id: string;
  title: string;
  poster: string;
  rate?: string;
  type?: string;
}

function SearchCircle({
  className = '',
  fillColor = 'none',
}: {
  className?: string;
  fillColor?: string;
}) {
  return (
    <svg
      width='44'
      height='44'
      viewBox='0 0 44 44'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={`${className} block relative`}
    >
      <circle
        cx='22'
        cy='22'
        r='20'
        stroke='white'
        strokeWidth='1.5'
        fill={fillColor}
      />
      <foreignObject x='0' y='0' width='44' height='44'>
        <div className='w-full h-full flex items-center justify-center'>
          <Search className='h-7 w-7 text-white' strokeWidth={2} />
        </div>
      </foreignObject>
    </svg>
  );
}

const DemoCard = ({ id, title, poster, rate, type }: DemoCardProps) => {
  const [hover, setHover] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    router.push(`/aggregate?q=${encodeURIComponent(title)}&type=${type}`);
  };

  return (
    <div
      className='group relative w-full rounded-lg bg-transparent flex flex-col cursor-pointer transition-all duration-300 ease-in-out'
      onClick={handleClick}
    >
      <div className='relative aspect-[2/3] w-full overflow-hidden rounded-2xl rt-poster-frame group-hover:scale-[1.025] transition-all duration-500'>
        <PosterImage
          src={poster}
          alt={title}
          fill
          className='object-cover transition-transform duration-700 ease-out group-hover:scale-110'
          priority={false}
        />
        <div
          className='pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent'
          aria-hidden
        />

        {rate && (
          <div className='absolute top-2 right-2 min-w-[1.25rem] h-4 sm:h-7 sm:min-w-[1.75rem] bg-slate-950/75 backdrop-blur-md border border-teal-400/35 rounded-lg flex items-center justify-center px-1.5 shadow-md transition-transform duration-300 group-hover:scale-110'>
            <span className='text-teal-200 text-[0.5rem] sm:text-xs font-bold leading-none tabular-nums'>
              {rate}
            </span>
          </div>
        )}

        <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center'>
          <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className={`transition-all duration-300 ${
              hover ? 'scale-110' : 'scale-90'
            }`}
          >
            <SearchCircle fillColor={hover ? '#14b8a6' : 'none'} />
          </div>
        </div>

        <a
          href={`https://movie.douban.com/subject/${id}`}
          target='_blank'
          rel='noopener noreferrer'
          onClick={(e) => e.stopPropagation()}
          className='absolute top-2 left-2 scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-all duration-300'
        >
          <div className='w-4 h-4 sm:w-7 sm:h-7 rounded-lg bg-teal-500 flex items-center justify-center shadow-md opacity-80 hover:opacity-100 hover:scale-110 transition-all'>
            <LinkIcon className='w-4 h-4 text-white' strokeWidth={2} />
          </div>
        </a>
      </div>

      <span className='mt-2.5 px-0.5 block text-slate-900 font-medium truncate w-full text-center text-[0.7rem] sm:text-[0.8125rem] leading-snug tracking-tight dark:text-slate-100 transition-all duration-300 group-hover:-translate-y-0.5 opacity-90 group-hover:opacity-100 group-hover:text-teal-700 dark:group-hover:text-teal-300'>
        {title}
      </span>
    </div>
  );
};

export default DemoCard;
