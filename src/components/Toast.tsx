'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastItem = { id: number; text: string; tone: 'ok' | 'warn' | 'err' };

type ToastApi = {
  toast: (text: string, tone?: ToastItem['tone']) => void;
};

const ToastContext = createContext<ToastApi>({
  toast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, text, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 2800);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className='pointer-events-none fixed bottom-20 md:bottom-6 left-1/2 z-[200] flex w-[min(92vw,22rem)] -translate-x-1/2 flex-col gap-2'
        aria-live='polite'
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md animate-slide-up ${
              item.tone === 'ok'
                ? 'bg-teal-500/95 text-slate-950'
                : item.tone === 'warn'
                  ? 'bg-amber-500/95 text-slate-950'
                  : 'bg-red-500/95 text-white'
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
