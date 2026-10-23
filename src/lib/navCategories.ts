/**
 * 发现分区：先片种，再题材/地区（对齐爱奇艺 / B站 / 豆瓣）
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

export type DiscoverSection = {
  id: string;
  label: string;
  icon: NavCategory['icon'];
  items: NavCategory[];
};

export const DISCOVER_SECTIONS: DiscoverSection[] = [
  {
    id: 'movie',
    label: '电影',
    icon: 'film',
    items: [
      {
        icon: 'film',
        label: '热门',
        href: '/douban?type=movie&tag=热门&title=热门电影',
      },
      {
        icon: 'star',
        label: 'Top250',
        href: '/douban?type=movie&tag=top250&title=豆瓣 Top250',
      },
      {
        icon: 'globe',
        label: '欧美',
        href: '/douban?type=movie&tag=欧美&title=欧美电影',
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
    ],
  },
  {
    id: 'tv',
    label: '电视剧',
    icon: 'tv',
    items: [
      {
        icon: 'tv',
        label: '热门',
        href: '/douban?type=tv&tag=热门&title=热门剧集',
      },
      {
        icon: 'swords',
        label: '美剧',
        href: '/douban?type=tv&tag=美剧&title=美剧',
      },
      {
        icon: 'heart',
        label: '韩剧',
        href: '/douban?type=tv&tag=韩剧&title=韩剧',
      },
      {
        icon: 'snow',
        label: '日剧',
        href: '/douban?type=tv&tag=日剧&title=日剧',
      },
      {
        icon: 'globe',
        label: '英剧',
        href: '/douban?type=tv&tag=英剧&title=英剧',
      },
    ],
  },
  {
    id: 'variety',
    label: '综艺',
    icon: 'clover',
    items: [
      {
        icon: 'clover',
        label: '热门综艺',
        href: '/douban?type=tv&tag=综艺&title=综艺',
      },
    ],
  },
  {
    id: 'anime',
    label: '动漫',
    icon: 'mask',
    items: [
      {
        icon: 'mask',
        label: '日本动画',
        href: '/douban?type=tv&tag=日本动画&title=日本动画',
      },
    ],
  },
  {
    id: 'doc',
    label: '纪录片',
    icon: 'book',
    items: [
      {
        icon: 'book',
        label: '纪录片',
        href: '/douban?type=movie&tag=纪录片&title=纪录片',
      },
    ],
  },
  {
    id: 'duanju',
    label: '短剧',
    icon: 'phone',
    items: [
      {
        icon: 'phone',
        label: '短剧热播',
        href: '/duanju',
      },
    ],
  },
];

/** 扁平列表（侧栏折叠态图标等兼容用） */
export const DOUBAN_CATEGORIES: NavCategory[] = DISCOVER_SECTIONS.flatMap(
  (s) => s.items
);
