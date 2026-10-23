/**
 * 发现分区：片种 → 地区 × 类型（豆瓣 new_search_subjects，对齐爱奇艺）
 */
export type NavIcon =
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

export type NavCategory = {
  label: string;
  href: string;
  icon: NavIcon;
};

export type DiscoverChip = {
  label: string;
  /** 空字符串 = 不限 */
  value: string;
};

/** 豆瓣 kind → new_search_subjects 的 tags */
export type DoubanKind = 'movie' | 'tv' | 'variety' | 'anime' | 'doc';

export const DOUBAN_KIND_TAGS: Record<DoubanKind, string> = {
  movie: '电影',
  tv: '电视剧',
  variety: '综艺',
  anime: '动画',
  doc: '纪录片',
};

export type DiscoverSection = {
  id: string;
  label: string;
  icon: NavIcon;
  mode: 'douban' | 'duanju';
  kind?: DoubanKind;
  regions?: DiscoverChip[];
  genres?: DiscoverChip[];
};

const ALL: DiscoverChip = { label: '全部', value: '' };

const MOVIE_REGIONS: DiscoverChip[] = [
  ALL,
  { label: '中国大陆', value: '中国大陆' },
  { label: '中国香港', value: '中国香港' },
  { label: '美国', value: '美国' },
  { label: '韩国', value: '韩国' },
  { label: '日本', value: '日本' },
  { label: '英国', value: '英国' },
  { label: '法国', value: '法国' },
];

const MOVIE_GENRES: DiscoverChip[] = [
  ALL,
  { label: '喜剧', value: '喜剧' },
  { label: '爱情', value: '爱情' },
  { label: '动作', value: '动作' },
  { label: '科幻', value: '科幻' },
  { label: '悬疑', value: '悬疑' },
  { label: '犯罪', value: '犯罪' },
  { label: '惊悚', value: '惊悚' },
  { label: '恐怖', value: '恐怖' },
  { label: '奇幻', value: '奇幻' },
  { label: '战争', value: '战争' },
  { label: '动画', value: '动画' },
];

const TV_REGIONS: DiscoverChip[] = [
  ALL,
  { label: '中国大陆', value: '中国大陆' },
  { label: '中国香港', value: '中国香港' },
  { label: '美国', value: '美国' },
  { label: '韩国', value: '韩国' },
  { label: '日本', value: '日本' },
  { label: '英国', value: '英国' },
];

const TV_GENRES: DiscoverChip[] = [
  ALL,
  { label: '剧情', value: '剧情' },
  { label: '喜剧', value: '喜剧' },
  { label: '爱情', value: '爱情' },
  { label: '悬疑', value: '悬疑' },
  { label: '犯罪', value: '犯罪' },
  { label: '奇幻', value: '奇幻' },
  { label: '动作', value: '动作' },
  { label: '科幻', value: '科幻' },
];

const VARIETY_REGIONS: DiscoverChip[] = [
  ALL,
  { label: '中国大陆', value: '中国大陆' },
  { label: '韩国', value: '韩国' },
  { label: '日本', value: '日本' },
  { label: '美国', value: '美国' },
];

const ANIME_REGIONS: DiscoverChip[] = [
  ALL,
  { label: '日本', value: '日本' },
  { label: '中国大陆', value: '中国大陆' },
  { label: '美国', value: '美国' },
];

const DOC_REGIONS: DiscoverChip[] = [
  ALL,
  { label: '中国大陆', value: '中国大陆' },
  { label: '美国', value: '美国' },
  { label: '英国', value: '英国' },
  { label: '日本', value: '日本' },
];

export const DISCOVER_SECTIONS: DiscoverSection[] = [
  {
    id: 'movie',
    label: '电影',
    icon: 'film',
    mode: 'douban',
    kind: 'movie',
    regions: MOVIE_REGIONS,
    genres: MOVIE_GENRES,
  },
  {
    id: 'tv',
    label: '电视剧',
    icon: 'tv',
    mode: 'douban',
    kind: 'tv',
    regions: TV_REGIONS,
    genres: TV_GENRES,
  },
  {
    id: 'variety',
    label: '综艺',
    icon: 'clover',
    mode: 'douban',
    kind: 'variety',
    regions: VARIETY_REGIONS,
  },
  {
    id: 'anime',
    label: '动漫',
    icon: 'mask',
    mode: 'douban',
    kind: 'anime',
    regions: ANIME_REGIONS,
  },
  {
    id: 'doc',
    label: '纪录片',
    icon: 'book',
    mode: 'douban',
    kind: 'doc',
    regions: DOC_REGIONS,
  },
  {
    id: 'duanju',
    label: '短剧',
    icon: 'phone',
    mode: 'duanju',
    genres: [
      { label: '全部', value: 'all' },
      { label: '都市', value: 'urban' },
      { label: '古装', value: 'ancient' },
      { label: '穿越', value: 'travel' },
      { label: '重生', value: 'rebirth' },
      { label: '反转', value: 'twist' },
      { label: '恋爱', value: 'romance' },
      { label: '逆袭', value: 'rise' },
      { label: '悬疑', value: 'mystery' },
    ],
  },
];

/** 侧栏 / 旧链接用的快捷入口 */
function doubanHref(
  kind: DoubanKind,
  opts: { countries?: string; genres?: string; title?: string } = {}
): string {
  const p = new URLSearchParams();
  p.set('kind', kind);
  if (opts.countries) p.set('countries', opts.countries);
  if (opts.genres) p.set('genres', opts.genres);
  if (opts.title) p.set('title', opts.title);
  return `/douban?${p.toString()}`;
}

export const DOUBAN_CATEGORIES: NavCategory[] = [
  { icon: 'phone', label: '短剧', href: '/duanju' },
  {
    icon: 'film',
    label: '热门电影',
    href: doubanHref('movie', { title: '热门电影' }),
  },
  {
    icon: 'tv',
    label: '热门剧集',
    href: doubanHref('tv', { title: '热门剧集' }),
  },
  {
    icon: 'star',
    label: '豆瓣 Top250',
    href: '/douban?type=movie&tag=top250&title=豆瓣 Top250',
  },
  {
    icon: 'book',
    label: '纪录片',
    href: doubanHref('doc', { title: '纪录片' }),
  },
  {
    icon: 'globe',
    label: '华语电影',
    href: doubanHref('movie', {
      countries: '中国大陆',
      title: '华语电影',
    }),
  },
  {
    icon: 'globe',
    label: '美国电影',
    href: doubanHref('movie', { countries: '美国', title: '美国电影' }),
  },
  {
    icon: 'flask',
    label: '科幻',
    href: doubanHref('movie', { genres: '科幻', title: '科幻' }),
  },
  {
    icon: 'ghost',
    label: '悬疑',
    href: doubanHref('movie', { genres: '悬疑', title: '悬疑' }),
  },
  {
    icon: 'clover',
    label: '综艺',
    href: doubanHref('variety', { title: '综艺' }),
  },
  {
    icon: 'swords',
    label: '美剧',
    href: doubanHref('tv', { countries: '美国', title: '美剧' }),
  },
  {
    icon: 'heart',
    label: '韩剧',
    href: doubanHref('tv', { countries: '韩国', title: '韩剧' }),
  },
  {
    icon: 'snow',
    label: '日剧',
    href: doubanHref('tv', { countries: '日本', title: '日剧' }),
  },
  {
    icon: 'mask',
    label: '动漫',
    href: doubanHref('anime', { title: '动漫' }),
  },
];

/** Sidebar 按片种分组展示 */
export function getSidebarGroups(): {
  label: string;
  items: NavCategory[];
}[] {
  return [
    {
      label: '电影',
      items: DOUBAN_CATEGORIES.filter((c) =>
        ['热门电影', '豆瓣 Top250', '华语电影', '美国电影', '科幻', '悬疑'].includes(
          c.label
        )
      ),
    },
    {
      label: '剧集',
      items: DOUBAN_CATEGORIES.filter((c) =>
        ['热门剧集', '美剧', '韩剧', '日剧'].includes(c.label)
      ),
    },
    {
      label: '更多',
      items: DOUBAN_CATEGORIES.filter((c) =>
        ['综艺', '动漫', '纪录片', '短剧'].includes(c.label)
      ),
    },
  ];
}

export function buildDiscoverApiUrl(opts: {
  kind: DoubanKind;
  countries?: string;
  genres?: string;
  sort?: 'T' | 'R' | 'S';
  start?: number;
}): string {
  const p = new URLSearchParams();
  p.set('kind', opts.kind);
  if (opts.countries) p.set('countries', opts.countries);
  if (opts.genres) p.set('genres', opts.genres);
  p.set('sort', opts.sort || 'T');
  p.set('start', String(opts.start ?? 0));
  return `/api/douban?${p.toString()}`;
}
