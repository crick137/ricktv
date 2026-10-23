import type { SearchResult } from '@/lib/types';
import {
  getAllSourceHealth,
  isSourceSuspended,
  recordSourceFailure,
  recordSourceSuccess,
} from '@/lib/sourceHealth';

export type StreamSourceEvent = {
  type: 'source';
  sourceKey: string;
  sourceName: string;
  ok: boolean;
  list: SearchResult[];
  ms: number;
  timedOut?: boolean;
  error?: string;
};

export type StreamDoneEvent = { type: 'done' };

export type StreamEvent = StreamSourceEvent | StreamDoneEvent;

export type StreamSearchHandlers = {
  onSource: (evt: StreamSourceEvent, allSoFar: SearchResult[]) => void;
  onDone?: (all: SearchResult[]) => void;
  signal?: AbortSignal;
  /** 只搜这些源 key（短剧分栏等） */
  sites?: string[];
};

/**
 * 流式搜索：边收边画，并写入源健康度（LibreTV NDJSON 机制）
 */
export async function streamSearch(
  query: string,
  handlers: StreamSearchHandlers
): Promise<SearchResult[]> {
  const exclude: string[] = [];
  try {
    const health = getAllSourceHealth();
    for (const key of Object.keys(health)) {
      if (isSourceSuspended(key)) exclude.push(key);
    }
  } catch {
    /* ignore */
  }

  const qs = new URLSearchParams({ q: query, stream: '1' });
  if (exclude.length) qs.set('exclude', exclude.join(','));
  if (handlers.sites?.length) qs.set('sites', handlers.sites.join(','));

  const res = await fetch(`/api/search?${qs.toString()}`, {
    cache: 'no-store',
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`搜索失败 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const all: SearchResult[] = [];
  const seen = new Set<string>();

  const merge = (list: SearchResult[]) => {
    for (const item of list) {
      if (isSourceSuspended(item.source)) continue;
      const k = `${item.source}-${item.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      all.push(item);
    }
  };

  const handleEvent = (evt: StreamEvent) => {
    if (evt.type === 'source') {
      if (evt.ok && evt.list.length) {
        recordSourceSuccess(evt.sourceKey, evt.ms);
        merge(evt.list);
      } else {
        recordSourceFailure(evt.sourceKey, {
          timedOut: evt.timedOut,
          error: evt.error,
        });
      }
      handlers.onSource(evt, all.slice());
    } else if (evt.type === 'done') {
      handlers.onDone?.(all.slice());
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleEvent(JSON.parse(line) as StreamEvent);
      } catch {
        /* skip bad line */
      }
    }
  }

  if (buffer.trim()) {
    try {
      handleEvent(JSON.parse(buffer) as StreamEvent);
    } catch {
      /* ignore */
    }
  }

  return all;
}
