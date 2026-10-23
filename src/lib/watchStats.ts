/** 观影时长统计（本机） */

const STORAGE_KEY = 'ricktv1-watch-stats';

type DayBucket = { date: string; seconds: number };

type StatsStore = {
  days: DayBucket[];
  totalSeconds: number;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function read(): StatsStore {
  if (typeof window === 'undefined') return { days: [], totalSeconds: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { days: [], totalSeconds: 0 };
    return JSON.parse(raw) as StatsStore;
  } catch {
    return { days: [], totalSeconds: 0 };
  }
}

function write(store: StatsStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

/** 累加观看秒数（建议每次进度保存时加增量） */
export function recordWatchSeconds(seconds: number) {
  if (!seconds || seconds < 1 || seconds > 3600) return;
  const store = read();
  const key = todayKey();
  const day = store.days.find((d) => d.date === key);
  if (day) day.seconds += seconds;
  else store.days.push({ date: key, seconds });
  store.totalSeconds += seconds;
  // 只保留近 60 天
  store.days = store.days
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 60);
  write(store);
}

export function getWatchStatsSummary() {
  const store = read();
  const now = Date.now();
  let weekSeconds = 0;
  for (const d of store.days) {
    const t = Date.parse(d.date);
    if (!Number.isNaN(t) && now - t <= 7 * 24 * 3600 * 1000) {
      weekSeconds += d.seconds;
    }
  }
  return {
    weekSeconds,
    totalSeconds: store.totalSeconds,
    todaySeconds: store.days.find((d) => d.date === todayKey())?.seconds || 0,
  };
}

export function formatWatchDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分钟`;
  return `${s} 秒`;
}

export function getAllWatchStats(): StatsStore {
  return read();
}

export function replaceAllWatchStats(store: StatsStore) {
  if (!store || typeof store !== 'object') {
    write({ days: [], totalSeconds: 0 });
    return;
  }
  write({
    days: Array.isArray(store.days) ? store.days : [],
    totalSeconds:
      typeof store.totalSeconds === 'number' ? store.totalSeconds : 0,
  });
}
