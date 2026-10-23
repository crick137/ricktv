/**
 * 从剧名推断下一季 / 下一部标题，用于看完续推
 */

const CN_NUM: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function toNum(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (CN_NUM[s] != null) return CN_NUM[s];
  if (s === '十') return 10;
  if (s.startsWith('十') && CN_NUM[s[1]]) return 10 + CN_NUM[s[1]];
  if (s.endsWith('十') && CN_NUM[s[0]]) return CN_NUM[s[0]] * 10;
  return null;
}

function toCn(n: number): string {
  if (n >= 1 && n <= 10) return NUM_CN[n];
  if (n > 10 && n < 20) return `十${NUM_CN[n - 10]}`;
  return String(n);
}

export type SeriesNext = {
  /** 下一季搜索词 */
  nextQuery: string;
  /** 展示文案 */
  label: string;
  /** 解析到的当前季（没有则为 null） */
  currentSeason: number | null;
};

/**
 * 例：
 * 「某某 第二季」→「某某 第三季」
 * 「某某 Season 2」→「某某 Season 3」
 * 「某某」无季信息 → 尝试「某某 第二季」
 */
export function resolveNextSeason(title: string): SeriesNext | null {
  const t = (title || '').trim();
  if (!t) return null;

  // 第N季 / 第N部 / 第N章
  const m1 = t.match(
    /^(.*?)[\s·\-_]*(第\s*([一二三四五六七八九十\d]+)\s*([季部章]))(.*)$/i
  );
  if (m1) {
    const n = toNum(m1[3].replace(/\s/g, ''));
    if (n != null && n < 30) {
      const next = n + 1;
      const unit = m1[4];
      const nextToken = `第${/^\d+$/.test(m1[3].trim()) ? next : toCn(next)}${unit}`;
      const nextQuery = `${m1[1].trim()} ${nextToken}${m1[5] || ''}`.trim();
      return {
        nextQuery,
        label: `下一${unit}：${nextQuery}`,
        currentSeason: n,
      };
    }
  }

  // Season N / S0N
  const m2 = t.match(/^(.*?)[\s·\-_]*season\s*(\d+)(.*)$/i);
  if (m2) {
    const n = parseInt(m2[2], 10);
    if (n < 30) {
      const nextQuery = `${m2[1].trim()} Season ${n + 1}${m2[3] || ''}`.trim();
      return {
        nextQuery,
        label: `下一季：${nextQuery}`,
        currentSeason: n,
      };
    }
  }
  const m3 = t.match(/^(.*?)[\s·\-_]*s0*(\d+)(.*)$/i);
  if (m3) {
    const n = parseInt(m3[2], 10);
    if (n < 30) {
      const nextQuery = `${m3[1].trim()} S${String(n + 1).padStart(2, '0')}${m3[3] || ''}`.trim();
      return {
        nextQuery,
        label: `下一季：${nextQuery}`,
        currentSeason: n,
      };
    }
  }

  // 无季标记但像剧集：猜「第二季」
  // 去掉常见后缀噪声
  const base = t
    .replace(/[\s\-_]*(完结|国语|粤语|中字|HD|4K|1080P).*$/i, '')
    .trim();
  if (base.length >= 2 && base.length <= 40) {
    return {
      nextQuery: `${base} 第二季`,
      label: `试试：${base} 第二季`,
      currentSeason: null,
    };
  }

  return null;
}

/** 系列根名（去掉季信息），用于「同系列」搜索 */
export function seriesRootTitle(title: string): string {
  return (title || '')
    .replace(/[\s·\-_]*(第\s*[一二三四五六七八九十\d]+\s*[季部章]).*$/i, '')
    .replace(/[\s·\-_]*season\s*\d+.*$/i, '')
    .replace(/[\s·\-_]*s0*\d+.*$/i, '')
    .trim() || title;
}
