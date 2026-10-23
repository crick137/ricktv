/**
 * 源质量分：健康度 + 测速 + 偏好 + 线路完整度
 * 分数越高越优先；熔断源直接垫底
 */

import { getPreferredSource } from '@/lib/sourcePref';
import {
  getSourceHealth,
  isSourceSuspended,
  type SourceHealthEntry,
} from '@/lib/sourceHealth';
import type { SpeedResult } from '@/lib/sourceSpeed';

export type QualityInput = {
  source: string;
  id: string;
  episodeCount?: number;
  speed?: SpeedResult;
  preferredSource?: string | null;
  health?: SourceHealthEntry;
};

/** 0–10000 左右；熔断为负数 */
export function scoreSourceQuality(input: QualityInput): number {
  const { source, speed, episodeCount = 0 } = input;
  if (isSourceSuspended(source)) return -100000;

  const health = input.health ?? getSourceHealth(source);
  const pref =
    input.preferredSource !== undefined
      ? input.preferredSource
      : null;

  let score = 1000;

  // 测速：越快越高（首包 0ms → +5000，4000ms → 0）
  if (speed?.ok && speed.ms != null) {
    score += Math.max(0, 5000 - speed.ms);
  } else if (speed && !speed.ok) {
    score -= 2500;
  } else if (health.lastMs != null) {
    score += Math.max(0, 3500 - health.lastMs) * 0.6;
  }

  // 健康：近期成功加分，失败扣分
  if (health.lastOkAt && Date.now() - health.lastOkAt < 7 * 86400000) {
    score += 280;
  }
  score -= health.consecutiveFails * 420;
  score -= health.suspendLevel * 800;

  // 偏好源
  if (pref && source === pref) score += 900;

  // 线路更完整（集数更多）轻微加分
  if (episodeCount > 1) {
    score += Math.min(400, episodeCount * 8);
  }

  return Math.round(score);
}

export function rankSourcesByQuality<
  T extends { source: string; id: string; episodes?: string[] },
>(
  list: T[],
  opts: {
    speeds?: Record<string, SpeedResult>;
    title?: string;
  } = {}
): T[] {
  const pref = opts.title ? getPreferredSource(opts.title) : null;
  return [...list]
    .filter((r) => !isSourceSuspended(r.source))
    .sort((a, b) => {
      const sa = scoreSourceQuality({
        source: a.source,
        id: a.id,
        episodeCount: a.episodes?.length || 0,
        speed: opts.speeds?.[`${a.source}-${a.id}`],
        preferredSource: pref,
      });
      const sb = scoreSourceQuality({
        source: b.source,
        id: b.id,
        episodeCount: b.episodes?.length || 0,
        speed: opts.speeds?.[`${b.source}-${b.id}`],
        preferredSource: pref,
      });
      return sb - sa;
    });
}

export function qualityLabel(score: number): string {
  if (score >= 4500) return '优';
  if (score >= 2800) return '良';
  if (score >= 1000) return '中';
  if (score >= 0) return '弱';
  return '停';
}

export function qualityTone(score: number): string {
  if (score >= 4500) return 'text-teal-300 border-teal-400/50 bg-teal-500/15';
  if (score >= 2800) return 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10';
  if (score >= 1000) return 'text-amber-300 border-amber-400/40 bg-amber-500/10';
  if (score >= 0) return 'text-orange-300 border-orange-500/40 bg-orange-500/10';
  return 'text-red-400 border-red-500/40 bg-red-500/10';
}
