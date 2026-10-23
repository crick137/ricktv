/**
 * 源健康度（LibreTV 机制）：连续失败自动停用
 * 阶梯：30 分钟 → 24 小时 → 长期；成功一次降一级
 */

const STORAGE_KEY = 'ricktv1-source-health';

export type SuspendLevel = 0 | 1 | 2 | 3;

export type SourceHealthEntry = {
  consecutiveFails: number;
  suspendLevel: SuspendLevel;
  /** 到期时间戳；level=3 时为 null 表示长期 */
  suspendedUntil: number | null;
  lastMs: number | null;
  lastOkAt: number | null;
  lastFailAt: number | null;
  lastError?: string;
};

type HealthMap = Record<string, SourceHealthEntry>;

const TIER_MS: Record<SuspendLevel, number | null> = {
  0: 0,
  1: 30 * 60 * 1000,
  2: 24 * 60 * 60 * 1000,
  3: null, // permanent until manual restore
};

function emptyEntry(): SourceHealthEntry {
  return {
    consecutiveFails: 0,
    suspendLevel: 0,
    suspendedUntil: null,
    lastMs: null,
    lastOkAt: null,
    lastFailAt: null,
  };
}

function readAll(): HealthMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as HealthMap;
  } catch {
    return {};
  }
}

function writeAll(map: HealthMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getAllSourceHealth(): HealthMap {
  return readAll();
}

export function getSourceHealth(key: string): SourceHealthEntry {
  return readAll()[key] || emptyEntry();
}

export function isSourceSuspended(key: string, now = Date.now()): boolean {
  const e = getSourceHealth(key);
  if (e.suspendLevel === 0) return false;
  if (e.suspendLevel === 3) return true;
  if (e.suspendedUntil == null) return e.suspendLevel > 0;
  if (now >= e.suspendedUntil) {
    // 到期自动解冻但保留 level，下次失败会再升
    const map = readAll();
    const cur = map[key] || emptyEntry();
    cur.suspendLevel = 0;
    cur.suspendedUntil = null;
    cur.consecutiveFails = 0;
    map[key] = cur;
    writeAll(map);
    return false;
  }
  return true;
}

export function filterActiveSources<T extends { key: string }>(
  sites: T[]
): T[] {
  return sites.filter((s) => !isSourceSuspended(s.key));
}

export function recordSourceSuccess(key: string, ms?: number) {
  const map = readAll();
  const cur = map[key] || emptyEntry();
  cur.consecutiveFails = 0;
  cur.lastMs = typeof ms === 'number' ? ms : cur.lastMs;
  cur.lastOkAt = Date.now();
  if (cur.suspendLevel > 0) {
    cur.suspendLevel = (cur.suspendLevel - 1) as SuspendLevel;
  }
  if (cur.suspendLevel === 0) {
    cur.suspendedUntil = null;
  } else {
    const tier = TIER_MS[cur.suspendLevel];
    cur.suspendedUntil =
      tier == null ? null : Date.now() + tier;
  }
  map[key] = cur;
  writeAll(map);
}

export function recordSourceFailure(
  key: string,
  opts?: { timedOut?: boolean; error?: string }
) {
  const map = readAll();
  const cur = map[key] || emptyEntry();
  cur.consecutiveFails += 1;
  cur.lastFailAt = Date.now();
  cur.lastError = opts?.error || (opts?.timedOut ? 'timeout' : 'error');

  // 连续 2 次失败才升一级（LibreTV）
  if (cur.consecutiveFails >= 2) {
    const next = Math.min(3, cur.suspendLevel + 1) as SuspendLevel;
    cur.suspendLevel = next;
    cur.consecutiveFails = 0;
    const tier = TIER_MS[next];
    cur.suspendedUntil = next === 3 || tier == null ? null : Date.now() + tier;
  }
  map[key] = cur;
  writeAll(map);
}

export function restoreSource(key: string) {
  const map = readAll();
  map[key] = emptyEntry();
  writeAll(map);
}

export function restoreAllSources() {
  writeAll({});
}

/** 导入备份用：整表覆盖 */
export function replaceAllSourceHealth(map: HealthMap) {
  if (!map || typeof map !== 'object') {
    writeAll({});
    return;
  }
  writeAll(map);
}

export function healthBadgeLabel(entry: SourceHealthEntry): string {
  if (entry.suspendLevel === 3) return '长期停用';
  if (entry.suspendLevel > 0 && entry.suspendedUntil) {
    const left = entry.suspendedUntil - Date.now();
    if (left > 0) {
      const m = Math.ceil(left / 60000);
      return m >= 60 ? `停用 ${Math.ceil(m / 60)}h` : `停用 ${m}m`;
    }
  }
  if (entry.lastMs != null) return `上次 ${entry.lastMs}ms`;
  return '未知';
}

export function healthTone(entry: SourceHealthEntry): string {
  if (entry.suspendLevel === 3) return 'text-red-400 border-red-500/40 bg-red-500/10';
  if (entry.suspendLevel > 0)
    return 'text-amber-300 border-amber-400/40 bg-amber-500/10';
  if (entry.lastMs != null && entry.lastMs < 1500)
    return 'text-teal-300 border-teal-400/50 bg-teal-500/15';
  return 'text-slate-400 border-white/10 bg-white/5';
}
