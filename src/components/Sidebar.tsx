'use client';

import {
  BookOpen,
  Clover,
  Film,
  FlaskConical,
  Ghost,
  Github,
  Globe2,
  Home,
  Menu,
  MessageCircleHeart,
  MountainSnow,
  Search,
  Settings,
  Smartphone,
  Star,
  Swords,
  Tv,
  VenetianMask,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ComponentType,
} from 'react';

import { getSidebarGroups } from '@/lib/navCategories';

import { useSite } from './SiteProvider';

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
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

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
});

export const useSidebar = () => useContext(SidebarContext);

const Logo = () => {
  const { siteName } = useSite();
  return (
    <Link
      href='/'
      className='flex items-center justify-center gap-2.5 h-16 select-none hover:opacity-90 transition-opacity duration-200 px-2'
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src='/logo.png'
        alt=''
        className='h-8 w-8 rounded-xl shadow-sm shadow-teal-900/20 ring-1 ring-teal-500/20'
      />
      <span className='font-display text-[1.2rem] font-bold text-teal-700 dark:text-teal-300 tracking-tight'>
        {siteName}
      </span>
    </Link>
  );
};

interface SidebarProps {
  onToggle?: (collapsed: boolean) => void;
  activePath?: string;
}

// 浏览器环境下用全局变量缓存折叠状态，避免重新挂载时闪烁
declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
  }
}

const Sidebar = ({ onToggle, activePath = '/' }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 同一次 SPA 会话已读过折叠状态则直接复用，避免闪烁
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.__sidebarCollapsed === 'boolean'
    ) {
      return window.__sidebarCollapsed;
    }
    return false; // 默认展开
  });

  // 首次挂载读取 localStorage，刷新后保持上次折叠状态
  useLayoutEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      const val = JSON.parse(saved);
      setIsCollapsed(val);
      window.__sidebarCollapsed = val;
    }
  }, []);

  // 折叠状态同步到 <html> data 属性，供首屏 CSS 使用
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCollapsed) {
        document.documentElement.dataset.sidebarCollapsed = 'true';
      } else {
        delete document.documentElement.dataset.sidebarCollapsed;
      }
    }
  }, [isCollapsed]);

  const [active, setActive] = useState(activePath);

  useEffect(() => {
    // 优先使用传入的 activePath
    if (activePath) {
      setActive(activePath);
    } else {
      const getCurrentFullPath = () => {
        const queryString = searchParams.toString();
        return queryString ? `${pathname}?${queryString}` : pathname;
      };
      setActive(getCurrentFullPath());
    }
  }, [activePath, pathname, searchParams]);

  const handleToggle = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    if (typeof window !== 'undefined') {
      window.__sidebarCollapsed = newState;
    }
    onToggle?.(newState);
  }, [isCollapsed, onToggle]);

  const handleSearchClick = useCallback(() => {
    router.push('/search');
  }, [router]);

  const contextValue = {
    isCollapsed,
  };

  const { siteName } = useSite();
  const showGithub = siteName !== 'ricktv' && siteName !== 'ricktv1';

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* 移动端隐藏侧边栏 */}
      <div className='hidden md:flex'>
        <aside
          data-sidebar
          className={`fixed top-0 left-0 h-screen rt-glass transition-all duration-300 border-r border-slate-200/40 dark:border-white/5 z-10 ${
            isCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          <div className='flex h-full flex-col'>
            {/* 顶部 Logo 区域 */}
            <div className='relative h-16'>
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                  isCollapsed ? 'opacity-0' : 'opacity-100'
                }`}
              >
                <div className='w-[calc(100%-4rem)] flex justify-center'>
                  {!isCollapsed && <Logo />}
                </div>
              </div>
              <button
                onClick={handleToggle}
                className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-500/10 transition-colors duration-200 z-10 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/5 ${
                  isCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-2'
                }`}
              >
                <Menu className='h-4 w-4' />
              </button>
            </div>

            {/* 首页 / 搜索 / 设置 */}
            <nav className='px-2 mt-3 space-y-0.5'>
              <Link
                href='/'
                onClick={() => setActive('/')}
                data-active={active === '/'}
                className={`group relative flex items-center rounded-xl px-2 py-2 pl-4 text-slate-700 hover:bg-slate-500/8 hover:text-teal-700 data-[active=true]:bg-teal-500/12 data-[active=true]:text-teal-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-slate-300 dark:hover:text-teal-300 dark:data-[active=true]:bg-teal-500/10 dark:data-[active=true]:text-teal-300 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex items-center justify-center'>
                  <Home className='h-4 w-4 text-gray-500 group-hover:text-teal-500 data-[active=true]:text-teal-600 dark:text-gray-400 dark:group-hover:text-teal-400 dark:data-[active=true]:text-teal-400' />
                </div>
                {!isCollapsed && (
                  <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                    首页
                  </span>
                )}
              </Link>
              <Link
                href='/search'
                onClick={(e) => {
                  e.preventDefault();
                  handleSearchClick();
                  setActive('/search');
                }}
                data-active={active === '/search'}
                className={`group relative flex items-center rounded-xl px-2 py-2 pl-4 text-slate-700 hover:bg-slate-500/8 hover:text-teal-700 data-[active=true]:bg-teal-500/12 data-[active=true]:text-teal-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-slate-300 dark:hover:text-teal-300 dark:data-[active=true]:bg-teal-500/10 dark:data-[active=true]:text-teal-300 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex items-center justify-center'>
                  <Search className='h-4 w-4 text-gray-500 group-hover:text-teal-500 data-[active=true]:text-teal-600 dark:text-gray-400 dark:group-hover:text-teal-400 dark:data-[active=true]:text-teal-400' />
                </div>
                {!isCollapsed && (
                  <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                    搜索
                  </span>
                )}
              </Link>
              <Link
                href='/settings'
                onClick={() => setActive('/settings')}
                data-active={active === '/settings'}
                className={`group relative flex items-center rounded-xl px-2 py-2 pl-4 text-slate-700 hover:bg-slate-500/8 hover:text-teal-700 data-[active=true]:bg-teal-500/12 data-[active=true]:text-teal-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-slate-300 dark:hover:text-teal-300 dark:data-[active=true]:bg-teal-500/10 dark:data-[active=true]:text-teal-300 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex items-center justify-center'>
                  <Settings className='h-4 w-4 text-gray-500 group-hover:text-teal-500 data-[active=true]:text-teal-600 dark:text-gray-400 dark:group-hover:text-teal-400 dark:data-[active=true]:text-teal-400' />
                </div>
                {!isCollapsed && (
                  <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                    设置
                  </span>
                )}
              </Link>
            </nav>

            {/* 发现分区快捷入口 */}
            <div className='flex-1 overflow-y-auto px-2 pt-4'>
              <div className='space-y-4'>
                {getSidebarGroups().map((group) => (
                  <div key={group.label}>
                    {!isCollapsed && (
                      <p className='px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500'>
                        {group.label}
                      </p>
                    )}
                    <div className='space-y-0.5'>
                      {group.items.map((item) => {
                        const decodedActive = decodeURIComponent(active);
                        const decodedItemHref = decodeURIComponent(item.href);
                        const itemQs = item.href.includes('?')
                          ? item.href.slice(item.href.indexOf('?') + 1)
                          : '';
                        const itemParams = new URLSearchParams(itemQs);
                        const activeQs = decodedActive.includes('?')
                          ? decodedActive.slice(decodedActive.indexOf('?') + 1)
                          : '';
                        const activeParams = new URLSearchParams(activeQs);
                        const sameKind =
                          itemParams.get('kind') &&
                          itemParams.get('kind') === activeParams.get('kind') &&
                          (itemParams.get('countries') || '') ===
                            (activeParams.get('countries') || '') &&
                          (itemParams.get('genres') || '') ===
                            (activeParams.get('genres') || '');
                        const sameTag =
                          itemParams.get('tag') &&
                          itemParams.get('tag') === activeParams.get('tag');
                        const isActive =
                          decodedActive === decodedItemHref ||
                          !!sameKind ||
                          !!sameTag ||
                          (item.href.startsWith('/duanju') &&
                            decodedActive.startsWith('/duanju'));
                        const Icon = ICON_MAP[item.icon] || Film;
                        return (
                          <Link
                            key={item.href + item.label}
                            href={item.href}
                            onClick={() => setActive(item.href)}
                            data-active={isActive}
                            title={
                              isCollapsed
                                ? `${group.label} · ${item.label}`
                                : undefined
                            }
                            className={`group relative flex items-center rounded-xl px-2 py-2 pl-4 text-sm text-slate-700 hover:bg-slate-500/8 hover:text-teal-700 data-[active=true]:bg-teal-500/12 data-[active=true]:text-teal-700 transition-colors duration-200 min-h-[40px] dark:text-slate-300 dark:hover:text-teal-300 dark:data-[active=true]:bg-teal-500/10 dark:data-[active=true]:text-teal-300 ${
                              isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                            } gap-3 justify-start`}
                          >
                            <div className='w-4 h-4 flex items-center justify-center'>
                              <Icon className='h-4 w-4 text-gray-500 group-hover:text-teal-500 data-[active=true]:text-teal-600 dark:text-gray-400 dark:group-hover:text-teal-400 dark:data-[active=true]:text-teal-400' />
                            </div>
                            {!isCollapsed && (
                              <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                                {item.label}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {showGithub && (
                  <Link
                    href='https://github.com/crick137/ricktv'
                    className={`group relative flex items-center rounded-xl px-2 py-2 pl-4 text-sm text-slate-700 hover:bg-slate-500/8 hover:text-teal-700 transition-colors duration-200 min-h-[40px] dark:text-slate-300 dark:hover:text-teal-300 ${
                      isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                    } gap-3 justify-start`}
                  >
                    <div className='w-4 h-4 flex items-center justify-center'>
                      <Github className='h-4 w-4 text-gray-500 group-hover:text-teal-500 dark:text-gray-400 dark:group-hover:text-teal-400' />
                    </div>
                    {!isCollapsed && (
                      <span className='whitespace-nowrap'>ricktv</span>
                    )}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </aside>
        <div
          className={`transition-all duration-300 sidebar-offset ${
            isCollapsed ? 'w-16' : 'w-60'
          }`}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
