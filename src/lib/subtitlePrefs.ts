/** 本地字幕显示偏好：字号 + 时间轴偏移 */

const STORAGE_KEY = 'ricktv1-subtitle-prefs';

export type SubtitlePrefs = {
  /** 相对默认字号的倍率，0.75–2 */
  scale: number;
  /** 字幕时间偏移（秒），正数＝延后显示 */
  offsetSec: number;
};

const DEFAULT: SubtitlePrefs = { scale: 1, offsetSec: 0 };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function getSubtitlePrefs(): SubtitlePrefs {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const p = JSON.parse(raw) as Partial<SubtitlePrefs>;
    return {
      scale: clamp(typeof p.scale === 'number' ? p.scale : 1, 0.75, 2),
      offsetSec: clamp(
        typeof p.offsetSec === 'number' ? p.offsetSec : 0,
        -15,
        15
      ),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function setSubtitlePrefs(patch: Partial<SubtitlePrefs>) {
  const cur = getSubtitlePrefs();
  const next: SubtitlePrefs = {
    scale: clamp(patch.scale ?? cur.scale, 0.75, 2),
    offsetSec: clamp(patch.offsetSec ?? cur.offsetSec, -15, 15),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

/** 把 offset 应用到 VTT 文本（简易：改 cue 时间戳） */
export function shiftVttTimestamps(vtt: string, offsetSec: number): string {
  if (!offsetSec) return vtt;
  const shift = (t: string) => {
    const m = t.trim().match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
    if (!m) return t;
    let ms =
      (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 +
      +m[4] +
      Math.round(offsetSec * 1000);
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const milli = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
  };
  return vtt.replace(
    /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g,
    (_, a, b) => `${shift(a)} --> ${shift(b)}`
  );
}
