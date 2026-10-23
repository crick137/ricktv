/**
 * 轻量标题模糊：归一化 + 子序列 + 编辑距离
 * （不做完整拼音库，够用且零依赖）
 */

const HOMOPHONE: Record<string, string> = {
  // 常见错别字 / 同音替换（搜片场景）
  的: '得',
  得: '的',
  地: '的',
  他: '她',
  她: '他',
  吗: '嘛',
  嘛: '吗',
  那: '哪',
  哪: '那',
  做: '作',
  作: '做',
  座: '坐',
  坐: '座',
  在: '再',
  再: '在',
  已: '以',
  以: '已',
  象: '像',
  像: '象',
  帐: '账',
  账: '帐',
  云: '运',
};

export function normalizeTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\s·・：:（）()【】[\]「」『』《》<>"'`~!@#$%^&*_+=|\\/;,.?？！，。、]/g, '')
    .replace(/第([一二三四五六七八九十\d]+)[季部]/g, 's$1')
    .trim();
}

function expandHomophone(s: string): string {
  return s
    .split('')
    .map((c) => HOMOPHONE[c] || c)
    .join('');
}

/** 查询字符是否按序出现在标题中 */
function isSubsequence(query: string, title: string): boolean {
  let i = 0;
  for (let j = 0; j < title.length && i < query.length; j++) {
    if (title[j] === query[i]) i++;
  }
  return i === query.length;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = Math.min(b.length, a.length + 4);
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ca = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = ca === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

/**
 * 标题对查询的相关分（越高越靠前）
 * 完全无关可返回负数
 */
export function titleMatchScore(query: string, title: string): number {
  const q0 = normalizeTitle(query);
  const t0 = normalizeTitle(title);
  if (!q0 || !t0) return 0;

  if (t0 === q0) return 1000;
  if (t0.includes(q0)) return 800 + Math.max(0, 40 - (t0.length - q0.length));
  if (q0.includes(t0) && t0.length >= 2) return 600;

  const q1 = expandHomophone(q0);
  const t1 = expandHomophone(t0);
  if (t1.includes(q1) || t0.includes(q1)) return 720;

  if (isSubsequence(q0, t0)) {
    return 400 + Math.max(0, 30 - (t0.length - q0.length));
  }

  // 短查询允许 1 编辑距离；长查询允许 2
  const maxDist = q0.length <= 4 ? 1 : 2;
  const slice = t0.slice(0, Math.min(t0.length, q0.length + 3));
  const dist = levenshtein(q0, slice);
  if (dist <= maxDist) return 350 - dist * 40;

  // 字符重叠率
  const setQ = new Set(q0.split(''));
  let hit = 0;
  for (const c of t0) if (setQ.has(c)) hit++;
  const ratio = hit / setQ.size;
  if (ratio >= 0.7 && q0.length >= 2) return Math.round(200 * ratio);

  return -1;
}

/** 过滤并按相关度排序；若全被滤掉则退回原列表按分数排 */
export function rankByTitleMatch<T extends { title: string }>(
  query: string,
  list: T[],
  opts?: { softFilter?: boolean }
): T[] {
  if (!query.trim() || list.length === 0) return list;
  const scored = list.map((item) => ({
    item,
    score: titleMatchScore(query, item.title),
  }));
  scored.sort((a, b) => b.score - a.score);

  if (opts?.softFilter !== false) {
    const kept = scored.filter((x) => x.score >= 0);
    if (kept.length > 0) return kept.map((x) => x.item);
  }
  return scored.map((x) => x.item);
}

/** 从结果里抽类型标签 */
export function collectTypeTags(
  list: { type_name?: string; class?: string; episodes?: string[] }[]
): string[] {
  const counts = new Map<string, number>();
  for (const item of list) {
    const raw = (item.type_name || item.class || '').trim();
    let tag = raw.split(/[/|·]/)[0]?.trim() || '';
    if (!tag) {
      tag = (item.episodes?.length || 0) > 1 ? '剧集' : '电影';
    }
    // 归一常见词
    if (/电影|片/.test(tag)) tag = '电影';
    else if (/短剧/.test(tag)) tag = '短剧';
    else if (/动漫|动画/.test(tag)) tag = '动漫';
    else if (/综艺/.test(tag)) tag = '综艺';
    else if (/剧|电视/.test(tag)) tag = '剧集';
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 8);
}

export function matchTypeTag(
  item: { type_name?: string; class?: string; episodes?: string[] },
  tag: string
): boolean {
  const raw = `${item.type_name || ''} ${item.class || ''}`;
  if (tag === '电影') return /电影|片/.test(raw) || (item.episodes?.length || 0) <= 1;
  if (tag === '剧集')
    return (
      (/剧|电视/.test(raw) && !/短剧|动漫|动画|综艺|电影/.test(raw)) ||
      (item.episodes?.length || 0) > 1
    );
  if (tag === '短剧') return /短剧/.test(raw);
  if (tag === '动漫') return /动漫|动画/.test(raw);
  if (tag === '综艺') return /综艺/.test(raw);
  return raw.includes(tag);
}
