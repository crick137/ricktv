/**
 * 侧栏 / 底栏共用的发现分区
 */
export type NavCategory = {
  label: string;
  href: string;
  /** lucide icon name key used by callers */
  icon:
    | 'film'
    | 'tv'
    | 'star'
    | 'clover'
    | 'swords'
    | 'heart'
    | 'snow'
    | 'mask'
    | 'book'
    | 'globe'
    | 'flask'
    | 'ghost'
    | 'phone';
};

export const DOUBAN_CATEGORIES: NavCategory[] = [
  {
    icon: 'phone',
    label: '短剧',
    href: '/duanju',
  },
  {
    icon: 'film',
    label: '热门电影',
    href: '/douban?type=movie&tag=热门&title=热门电影',
  },
  {
    icon: 'tv',
    label: '热门剧集',
    href: '/douban?type=tv&tag=热门&title=热门剧集',
  },
  {
    icon: 'star',
    label: '豆瓣 Top250',
    href: '/douban?type=movie&tag=top250&title=豆瓣 Top250',
  },
  {
    icon: 'book',
    label: '纪录片',
    href: '/douban?type=movie&tag=纪录片&title=纪录片',
  },
  {
    icon: 'globe',
    label: '欧美',
    href: '/douban?type=movie&tag=欧美&title=欧美电影',
  },
  {
    icon: 'globe',
    label: '英剧',
    href: '/douban?type=tv&tag=英剧&title=英剧',
  },
  {
    icon: 'flask',
    label: '科幻',
    href: '/douban?type=movie&tag=科幻&title=科幻',
  },
  {
    icon: 'ghost',
    label: '悬疑',
    href: '/douban?type=movie&tag=悬疑&title=悬疑',
  },
  {
    icon: 'clover',
    label: '综艺',
    href: '/douban?type=tv&tag=综艺&title=综艺',
  },
  { icon: 'swords', label: '美剧', href: '/douban?type=tv&tag=美剧&title=美剧' },
  {
    icon: 'heart',
    label: '韩剧',
    href: '/douban?type=tv&tag=韩剧&title=韩剧',
  },
  { icon: 'snow', label: '日剧', href: '/douban?type=tv&tag=日剧&title=日剧' },
  {
    icon: 'mask',
    label: '日漫',
    href: '/douban?type=tv&tag=日本动画&title=日本动画',
  },
];
