/**
 * 片名指纹：同剧不同源合并成一张卡
 */

import { normalizeTitle } from '@/lib/fuzzyTitle';

const NOISE =
  /(国语|粤语|中字|双语|高清|超清|蓝光|抢先|完整|未删减|加长|修复|HD|4K|1080[Pp]|720[Pp]|WEB-?DL|剧场版)/gi;

/** 指纹：去噪声、去年份括号、保留季信息 */
export function titleFingerprint(
  title: string,
  year?: string,
  doubanId?: number
): string {
  if (doubanId && doubanId > 0) return `db:${doubanId}`;

  let t = normalizeTitle(title);
  t = t.replace(NOISE, '');
  // 去掉结尾纯数字年份
  t = t.replace(/(19|20)\d{2}$/g, '');
  const y = (year || '').match(/\d{4}/)?.[0] || '';
  // 季信息已在 normalizeTitle 里变成 sN
  return y ? `${t}|${y}` : t;
}

export function sameFingerprint(
  a: { title: string; year?: string; douban_id?: number },
  b: { title: string; year?: string; douban_id?: number }
): boolean {
  return (
    titleFingerprint(a.title, a.year, a.douban_id) ===
    titleFingerprint(b.title, b.year, b.douban_id)
  );
}

/**
 * 按指纹聚合；组内按集数多、海报有货优先
 */
export function aggregateByFingerprint<
  T extends {
    title: string;
    year?: string;
    douban_id?: number;
    episodes?: string[];
    poster?: string;
  },
>(list: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const fp = titleFingerprint(item.title, item.year, item.douban_id);
    if (!fp) continue;
    const arr = map.get(fp) || [];
    arr.push(item);
    map.set(fp, arr);
  }

  const groups = Array.from(map.values()).map((group) =>
    [...group].sort((a, b) => {
      const ea = a.episodes?.length || 0;
      const eb = b.episodes?.length || 0;
      if (eb !== ea) return eb - ea;
      const pa = a.poster ? 1 : 0;
      const pb = b.poster ? 1 : 0;
      return pb - pa;
    })
  );

  // 多源优先，其次标题短（更像正式名）
  groups.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return (a[0]?.title?.length || 0) - (b[0]?.title?.length || 0);
  });

  return groups;
}
