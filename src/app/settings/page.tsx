'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  clearAllFavorites,
  clearAllPlayRecords,
  clearSearchHistory,
  getAllFavorites,
  getAllPlayRecords,
  getSearchHistory,
  importLocalBackup,
} from '@/lib/db.client';
import {
  getAllSceneBookmarks,
  replaceAllSceneBookmarks,
  type SceneBookmark,
} from '@/lib/sceneBookmarks';
import {
  clearAllSkipMarkers,
  getAllSkipMarkers,
  replaceAllSkipMarkers,
} from '@/lib/skipMarkers';
import {
  getAllSourceHealth,
  healthBadgeLabel,
  healthTone,
  replaceAllSourceHealth,
  restoreAllSources,
  restoreSource,
  type SourceHealthEntry,
} from '@/lib/sourceHealth';
import {
  getAllSourcePrefs,
  replaceAllSourcePrefs,
} from '@/lib/sourcePref';
import {
  clearMutedKeywords,
  getMutedKeywords,
  unmuteKeyword,
} from '@/lib/contentHygiene';
import {
  diagnoseSources,
  type DiagnoseRow,
} from '@/lib/sourceDiagnose';
import {
  getAllWatchTaste,
  replaceAllWatchTaste,
} from '@/lib/watchTaste';

import PageLayout from '@/components/PageLayout';
import {
  formatWatchDuration,
  getAllWatchStats,
  getWatchStatsSummary,
  replaceAllWatchStats,
} from '@/lib/watchStats';

function SettingsClient() {
  const [health, setHealth] = useState<Record<string, SourceHealthEntry>>({});
  const [markerCount, setMarkerCount] = useState(0);
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState(() => getWatchStatsSummary());
  const [muted, setMuted] = useState<string[]>([]);
  const [diag, setDiag] = useState<DiagnoseRow[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setHealth(getAllSourceHealth());
    setMarkerCount(Object.keys(getAllSkipMarkers()).length);
    setStats(getWatchStatsSummary());
    setMuted(getMutedKeywords());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2800);
  };

  const exportData = async () => {
    const [favorites, playRecords, searchHistory] = await Promise.all([
      getAllFavorites(),
      getAllPlayRecords(),
      getSearchHistory(),
    ]);
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      favorites,
      playRecords,
      searchHistory,
      sourceHealth: getAllSourceHealth(),
      skipMarkers: getAllSkipMarkers(),
      sceneBookmarks: getAllSceneBookmarks(),
      watchStats: getAllWatchStats(),
      sourcePrefs: getAllSourcePrefs(),
      watchTaste: getAllWatchTaste(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricks-nest-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('已导出本机数据');
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        favorites?: Record<string, unknown>;
        playRecords?: Record<string, unknown>;
        searchHistory?: string[];
        sourceHealth?: Record<string, SourceHealthEntry>;
        skipMarkers?: Record<
          string,
          { introEnd: number; outroStart?: number; updatedAt: number }
        >;
        sceneBookmarks?: SceneBookmark[];
        watchStats?: ReturnType<typeof getAllWatchStats>;
        sourcePrefs?: ReturnType<typeof getAllSourcePrefs>;
        watchTaste?: ReturnType<typeof getAllWatchTaste>;
      };
      if (!data || typeof data !== 'object') {
        throw new Error('无效的备份文件');
      }
      if (
        !confirm(
          '导入将覆盖本机收藏、续播、搜索历史、源健康、跳过标记、书签、统计与偏好。确定继续？'
        )
      ) {
        return;
      }
      await importLocalBackup({
        favorites: (data.favorites || {}) as Parameters<
          typeof importLocalBackup
        >[0]['favorites'],
        playRecords: (data.playRecords || {}) as Parameters<
          typeof importLocalBackup
        >[0]['playRecords'],
        searchHistory: data.searchHistory || [],
      });
      if (data.sourceHealth) replaceAllSourceHealth(data.sourceHealth);
      if (data.skipMarkers) replaceAllSkipMarkers(data.skipMarkers);
      if (data.sceneBookmarks) replaceAllSceneBookmarks(data.sceneBookmarks);
      if (data.watchStats) replaceAllWatchStats(data.watchStats);
      if (data.sourcePrefs) replaceAllSourcePrefs(data.sourcePrefs);
      if (data.watchTaste) replaceAllWatchTaste(data.watchTaste);
      refresh();
      flash('导入完成');
    } catch (e) {
      flash(e instanceof Error ? e.message : '导入失败');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const entries = Object.entries(health).sort((a, b) => {
    const la = a[1].suspendLevel;
    const lb = b[1].suspendLevel;
    if (la !== lb) return lb - la;
    return (b[1].lastFailAt || 0) - (a[1].lastFailAt || 0);
  });

  return (
    <PageLayout activePath='/settings'>
      <div className='px-4 sm:px-10 py-6 sm:py-10 max-w-3xl mx-auto'>
        <p className='rt-eyebrow mb-2'>rick&apos;s nest · settings</p>
        <h1 className='font-display text-[1.85rem] sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2'>
          设置
        </h1>
        <p className='text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-xl'>
          源健康、跳过标记与本机数据 — 都只存在你这台机器上。
        </p>

        {msg && (
          <div className='mb-4 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-800 dark:text-teal-200'>
            {msg}
          </div>
        )}

        <section className='mb-10 rt-glass rounded-2xl p-5'>
          <h2 className='font-display text-lg font-semibold text-slate-900 dark:text-white mb-3'>
            观影统计
          </h2>
          <div className='grid grid-cols-3 gap-3 text-center'>
            <div className='rounded-xl bg-teal-500/10 px-2 py-3'>
              <p className='text-xs text-slate-500 mb-1'>今日</p>
              <p className='text-sm font-semibold text-teal-700 dark:text-teal-300 tabular-nums'>
                {formatWatchDuration(stats.todaySeconds)}
              </p>
            </div>
            <div className='rounded-xl bg-teal-500/10 px-2 py-3'>
              <p className='text-xs text-slate-500 mb-1'>本周</p>
              <p className='text-sm font-semibold text-teal-700 dark:text-teal-300 tabular-nums'>
                {formatWatchDuration(stats.weekSeconds)}
              </p>
            </div>
            <div className='rounded-xl bg-teal-500/10 px-2 py-3'>
              <p className='text-xs text-slate-500 mb-1'>累计</p>
              <p className='text-sm font-semibold text-teal-700 dark:text-teal-300 tabular-nums'>
                {formatWatchDuration(stats.totalSeconds)}
              </p>
            </div>
          </div>
        </section>

        <section className='mb-10 rt-glass rounded-2xl p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='font-display text-lg font-semibold text-slate-900 dark:text-white'>
              源健康度
            </h2>
            <button
              type='button'
              onClick={() => {
                restoreAllSources();
                refresh();
                flash('已恢复全部源');
              }}
              className='text-sm text-teal-600 hover:text-teal-500 dark:text-teal-400'
            >
              全部恢复
            </button>
          </div>
          <p className='text-xs text-slate-500 mb-4'>
            连续失败 2 次 → 停用 30 分钟 → 24 小时 → 长期；成功一次降一级。播放失败会自动切更快的源。
          </p>
          {entries.length === 0 ? (
            <p className='text-sm text-slate-500'>暂无记录，搜几次片就会出现。</p>
          ) : (
            <ul className='space-y-2'>
              {entries.map(([key, entry]) => (
                <li
                  key={key}
                  className='flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 px-3 py-2'
                >
                  <div className='min-w-0'>
                    <p className='text-sm font-medium text-slate-800 dark:text-slate-100 truncate'>
                      {key}
                    </p>
                    <span
                      className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${healthTone(
                        entry
                      )}`}
                    >
                      {healthBadgeLabel(entry)}
                    </span>
                  </div>
                  {entry.suspendLevel > 0 && (
                    <button
                      type='button'
                      onClick={() => {
                        restoreSource(key);
                        refresh();
                        flash(`已恢复 ${key}`);
                      }}
                      className='shrink-0 text-xs px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-semibold hover:bg-teal-400'
                    >
                      恢复
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className='mb-10 rt-glass rounded-2xl p-5'>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='font-display text-lg font-semibold text-slate-900 dark:text-white'>
              一键诊断
            </h2>
            <button
              type='button'
              disabled={diagRunning}
              onClick={async () => {
                setDiagRunning(true);
                setDiag([]);
                try {
                  const rows = await diagnoseSources(6, (row) => {
                    setDiag((prev) => {
                      const rest = prev.filter((p) => p.key !== row.key);
                      return [...rest, row];
                    });
                  });
                  setDiag(rows);
                  const ok = rows.filter((r) => r.ok).length;
                  flash(`诊断完成：${ok}/${rows.length} 源正常`);
                } catch (e) {
                  flash(e instanceof Error ? e.message : '诊断失败');
                } finally {
                  setDiagRunning(false);
                }
              }}
              className='text-sm px-3 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-semibold disabled:opacity-50'
            >
              {diagRunning ? '探测中…' : '测 6 个热门源'}
            </button>
          </div>
          <p className='text-xs text-slate-500 mb-3'>
            通过本站代理探测采集接口首包延迟，方便排查网络/源站问题。
          </p>
          {diag.length > 0 && (
            <ul className='space-y-1.5'>
              {diag.map((r) => (
                <li
                  key={r.key}
                  className='flex items-center justify-between text-sm px-2 py-1.5 rounded-lg bg-white/40 dark:bg-white/5'
                >
                  <span className='truncate text-slate-700 dark:text-slate-200'>
                    {r.name}
                    {r.suspended ? ' ·停用' : ''}
                  </span>
                  <span
                    className={`tabular-nums text-xs ${
                      r.ok ? 'text-teal-600 dark:text-teal-400' : 'text-red-400'
                    }`}
                  >
                    {r.ok ? `${r.ms}ms` : r.error || '失败'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className='mb-10 rt-glass rounded-2xl p-5'>
          <div className='flex items-center justify-between mb-2'>
            <h2 className='font-display text-lg font-semibold text-slate-900 dark:text-white'>
              少推关键词
            </h2>
            {muted.length > 0 && (
              <button
                type='button'
                onClick={() => {
                  clearMutedKeywords();
                  refresh();
                  flash('已清空少推词');
                }}
                className='text-sm text-slate-500 hover:text-red-500'
              >
                清空
              </button>
            )}
          </div>
          <p className='text-xs text-slate-500 mb-3'>
            续看里点「不想看」会自动记入。搜索/推荐会避开这些词。
          </p>
          {muted.length === 0 ? (
            <p className='text-sm text-slate-500'>暂无</p>
          ) : (
            <div className='flex flex-wrap gap-2'>
              {muted.map((w) => (
                <button
                  key={w}
                  type='button'
                  onClick={() => {
                    unmuteKeyword(w);
                    refresh();
                  }}
                  className='text-xs px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-500'
                  title='点击取消'
                >
                  {w} ×
                </button>
              ))}
            </div>
          )}
        </section>

        <section className='mb-10 rt-glass rounded-2xl p-5'>
          <h2 className='font-display text-lg font-semibold text-slate-900 dark:text-white mb-2'>
            跳过标记
          </h2>
          <p className='text-sm text-slate-500 mb-4'>
            已记住 {markerCount} 部剧的片头/片尾。播放时点「记住此处为片头结束」写入。
          </p>
          <button
            type='button'
            onClick={() => {
              clearAllSkipMarkers();
              refresh();
              flash('已清空跳过标记');
            }}
            className='text-sm px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-red-400 hover:text-red-500'
          >
            清空全部跳过标记
          </button>
        </section>

        <section className='mb-10 rt-glass rounded-2xl p-5'>
          <h2 className='font-display text-lg font-semibold text-slate-900 dark:text-white mb-4'>
            本机数据
          </h2>
          <input
            ref={fileRef}
            type='file'
            accept='application/json,.json'
            className='hidden'
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
            }}
          />
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={exportData}
              className='px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm hover:bg-teal-400'
            >
              导出 JSON
            </button>
            <button
              type='button'
              onClick={() => fileRef.current?.click()}
              className='px-4 py-2 rounded-xl border border-teal-500/50 text-teal-700 dark:text-teal-300 font-semibold text-sm hover:bg-teal-500/10'
            >
              导入 JSON
            </button>
            <button
              type='button'
              onClick={async () => {
                if (!confirm('清空全部播放记录？')) return;
                await clearAllPlayRecords();
                flash('已清空播放记录');
              }}
              className='px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm'
            >
              清空续播
            </button>
            <button
              type='button'
              onClick={async () => {
                if (!confirm('清空全部收藏？')) return;
                await clearAllFavorites();
                flash('已清空收藏');
              }}
              className='px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm'
            >
              清空收藏
            </button>
            <button
              type='button'
              onClick={async () => {
                await clearSearchHistory();
                flash('已清空搜索历史');
              }}
              className='px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm'
            >
              清空搜索历史
            </button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsClient />
    </Suspense>
  );
}
