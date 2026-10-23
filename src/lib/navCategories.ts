/**
 * 发现分区：片种 → 题材/地区标签（对齐爱奇艺 / 腾讯视频频道页）
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

function movie(tag: string, label: string, icon: NavCategory['icon'] = 'film'): NavCategory {
  return {
    icon,
    label,
    href: `/douban?type=movie&tag=${encodeURIComponent(tag)}&title=${encodeURIComponent(label)}`,
  };
}

function tv(tag: string, label: string, icon: NavCategory['icon'] = 'tv'): NavCategory {
  return {
    icon,
    label,
    href: `/douban?type=tv&tag=${encodeURIComponent(tag)}&title=${encodeURIComponent(label)}`,
  };
}

export const DISCOVER_SECTIONS: DiscoverSection[] = [
  {
    id: 'movie',
    label: '电影',
    icon: 'film',
    items: [
      movie('热门', '热门'),
      movie('top250', 'Top250', 'star'),
      movie('豆瓣高分', '高分', 'star'),
      movie('华语', '华语', 'globe'),
      movie('欧美', '欧美', 'globe'),
      movie('韩国', '韩国', 'globe'),
      movie('日本', '日本', 'globe'),
      movie('喜剧', '喜剧'),
      movie('动作', '动作', 'swords'),
      movie('爱情', '爱情', 'heart'),
      movie('科幻', '科幻', 'flask'),
      movie('悬疑', '悬疑', 'ghost'),
      movie('恐怖', '恐怖', 'ghost'),
      movie('动画', '动画', 'mask'),
    ],
  },
  {
    id: 'tv',
    label: '电视剧',
    icon: 'tv',
    items: [
      tv('热门', '热门'),
      tv('国产剧', '国产'),
      tv('美剧', '美剧', 'swords'),
      tv('韩剧', '韩剧', 'heart'),
      tv('日剧', '日剧', 'snow'),
      tv('英剧', '英剧', 'globe'),
      tv('港剧', '港剧', 'globe'),
    ],
  },
  {
    id: 'variety',
    label: '综艺',
    icon: 'clover',
    items: [tv('综艺', '热门', 'clover')],
  },
  {
    id: 'anime',
    label: '动漫',
    icon: 'mask',
    items: [tv('日本动画', '日漫', 'mask')],
  },
  {
    id: 'doc',
    label: '纪录片',
    icon: 'book',
    items: [movie('纪录片', '热门', 'book')],
  },
  {
    id: 'duanju',
    label: '短剧',
    icon: 'phone',
    items: [
      { icon: 'phone', label: '全部', href: '/duanju?genre=all' },
      { icon: 'phone', label: '都市', href: '/duanju?genre=urban' },
      { icon: 'phone', label: '古装', href: '/duanju?genre=ancient' },
      { icon: 'phone', label: '穿越', href: '/duanju?genre=travel' },
      { icon: 'phone', label: '重生', href: '/duanju?genre=rebirth' },
      { icon: 'phone', label: '反转', href: '/duanju?genre=twist' },
      { icon: 'phone', label: '恋爱', href: '/duanju?genre=romance' },
      { icon: 'phone', label: '逆袭', href: '/duanju?genre=rise' },
      { icon: 'phone', label: '悬疑', href: '/duanju?genre=mystery' },
    ],
  },
];

/** 扁平列表（兼容旧引用） */
export const DOUBAN_CATEGORIES: NavCategory[] = DISCOVER_SECTIONS.flatMap(
  (s) => s.items
);

/** 从发现入口 href 解析拉列表所需参数 */
export function parseDiscoverHref(href: string): {
  mode: 'douban' | 'duanju';
  type?: string;
  tag?: string;
  genre?: string;
} {
  if (href.startsWith('/duanju')) {
    const q = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
    const params = new URLSearchParams(q);
    return { mode: 'duanju', genre: params.get('genre') || 'all' };
  }
  const q = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  return {
    mode: 'douban',
    type: params.get('type') || 'movie',
    tag: params.get('tag') || '热门',
  };
}
