/**
 * 短剧分栏：按 CMS 分类 type_id 拉列表（非关键词搜索）
 * type_id 来自各源 ?ac=list 实测
 */

export type DuanjuCatalog = {
  key: string;
  typeId: number;
  /** 题材；all = 大类混入热榜 */
  genre: DuanjuGenre;
  label?: string;
};

/** 统一题材（跨源映射） */
export type DuanjuGenre =
  | 'all'
  | 'urban'
  | 'ancient'
  | 'travel'
  | 'rebirth'
  | 'twist'
  | 'romance'
  | 'rise'
  | 'mystery';

export const DUANJU_GENRE_TABS: { id: DuanjuGenre; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'urban', label: '都市' },
  { id: 'ancient', label: '古装' },
  { id: 'travel', label: '穿越' },
  { id: 'rebirth', label: '重生' },
  { id: 'twist', label: '反转' },
  { id: 'romance', label: '恋爱' },
  { id: 'rise', label: '逆袭' },
  { id: 'mystery', label: '悬疑' },
];

/**
 * 大类（热榜默认）+ 各题材子类
 * 跳过擦边类 type_id
 */
export const DUANJU_CATALOGS: DuanjuCatalog[] = [
  // —— 全部 / 热榜 ——
  { key: 'bfzy', typeId: 58, genre: 'all', label: '短剧大全' },
  { key: 'lzi', typeId: 46, genre: 'all', label: '短剧' },
  { key: 'zuid', typeId: 54, genre: 'all', label: '爽文短剧' },
  { key: 'uku', typeId: 32, genre: 'all', label: '短剧' },
  { key: 'maoyan', typeId: 46, genre: 'all', label: '爽文短剧' },

  // —— 都市 ——
  { key: 'maoyan', typeId: 47, genre: 'urban', label: '短剧现代都市' },
  { key: 'zuid', typeId: 69, genre: 'urban', label: '现代都市' },
  { key: 'bfzy', typeId: 71, genre: 'urban', label: '都市脑洞' },

  // —— 古装 ——
  { key: 'maoyan', typeId: 50, genre: 'ancient', label: '短剧古装仙侠' },
  { key: 'zuid', typeId: 66, genre: 'ancient', label: '古装仙侠' },
  { key: 'bfzy', typeId: 72, genre: 'ancient', label: '古装仙侠' },

  // —— 穿越 ——
  { key: 'maoyan', typeId: 49, genre: 'travel', label: '短剧年代穿越' },
  { key: 'zuid', typeId: 67, genre: 'travel', label: '年代穿越' },
  { key: 'bfzy', typeId: 66, genre: 'travel', label: '穿越年代' },

  // —— 重生 ——
  { key: 'bfzy', typeId: 65, genre: 'rebirth', label: '重生民国' },

  // —— 反转 ——
  { key: 'maoyan', typeId: 51, genre: 'twist', label: '短剧反转爽剧' },
  { key: 'zuid', typeId: 65, genre: 'twist', label: '反转爽剧' },
  { key: 'bfzy', typeId: 68, genre: 'twist', label: '反转爽文' },

  // —— 恋爱 ——
  { key: 'maoyan', typeId: 52, genre: 'romance', label: '短剧女频恋爱' },
  { key: 'zuid', typeId: 64, genre: 'romance', label: '女频恋爱' },

  // —— 逆袭 ——
  { key: 'maoyan', typeId: 53, genre: 'rise', label: '短剧成长逆袭' },

  // —— 悬疑 ——
  { key: 'maoyan', typeId: 48, genre: 'mystery', label: '短剧脑洞悬疑' },
];

export type DuanjuSort = 'hot' | 'new';

export function catalogsForGenre(genre: DuanjuGenre): DuanjuCatalog[] {
  if (genre === 'all') {
    return DUANJU_CATALOGS.filter((c) => c.genre === 'all');
  }
  return DUANJU_CATALOGS.filter((c) => c.genre === genre);
}

export function parseDuanjuGenre(raw: string | null): DuanjuGenre {
  const g = (raw || 'all') as DuanjuGenre;
  return DUANJU_GENRE_TABS.some((t) => t.id === g) ? g : 'all';
}
