/** 播放偏好：音量 / 倍速 */

const VOLUME_KEY = 'ricktv1-pref-volume';
const RATE_KEY = 'ricktv1-pref-rate';

export function getSavedVolume(fallback = 0.7): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY) || '');
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveVolume(v: number) {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(v) || v < 0 || v > 1) return;
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.round(v * 100) / 100));
  } catch {
    /* ignore */
  }
}

export function getSavedPlaybackRate(fallback = 1): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = parseFloat(localStorage.getItem(RATE_KEY) || '');
    if (Number.isFinite(v) && v >= 0.5 && v <= 3) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function savePlaybackRate(v: number) {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(v) || v < 0.5 || v > 3) return;
  try {
    localStorage.setItem(RATE_KEY, String(v));
  } catch {
    /* ignore */
  }
}
