'use client';

import { Copy, Link2, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Role = 'idle' | 'host' | 'guest';

type SyncMsg = {
  source: 'ricktv1-couple';
  action: 'play' | 'pause' | 'seek' | 'hello' | 'state' | 'navigate' | 'heartbeat';
  t?: number;
  playing?: boolean;
  href?: string;
  from?: string;
  ts?: number;
};

/** 偏差超过此秒数 → 硬追帧 */
const CATCHUP_HARD = 2.5;
/** 偏差超过此秒数 → 软校正（仅 seek，不打断播放态） */
const CATCHUP_SOFT = 1.2;

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

function sameWatchUrl(a: string, b: string) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.origin === ub.origin &&
      ua.pathname === ub.pathname &&
      ua.search === ub.search
    );
  } catch {
    return a === b;
  }
}

const PEER_CDNS = [
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
];

function loadPeerCtor(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.Peer) {
      resolve(w.Peer);
      return;
    }
    const existing = document.querySelector('script[data-peerjs]');
    if (existing) {
      existing.addEventListener('load', () => resolve(w.Peer));
      existing.addEventListener('error', reject);
      return;
    }
    let i = 0;
    const tryNext = () => {
      if (i >= PEER_CDNS.length) {
        reject(new Error('PeerJS 加载失败'));
        return;
      }
      const s = document.createElement('script');
      s.src = PEER_CDNS[i++];
      s.async = true;
      s.dataset.peerjs = '1';
      s.onload = () => resolve(w.Peer);
      s.onerror = () => {
        s.remove();
        tryNext();
      };
      document.head.appendChild(s);
    };
    tryNext();
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  getPlayback: () => { currentTime: number; playing: boolean };
  applyCmd: (action: 'play' | 'pause' | 'seek', t?: number) => void;
};

/**
 * Couple Nest：房间码 + PeerJS
 * - 播停/进度
 * - 同链跳转（href 不一致则跟随）
 * - 弱网追帧（heartbeat 偏差校正）
 */
export default function CoupleNestPanel({
  open,
  onClose,
  getPlayback,
  applyCmd,
}: Props) {
  const [role, setRole] = useState<Role>('idle');
  const [room, setRoom] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [status, setStatus] = useState('未连接');
  const [peerCount, setPeerCount] = useState(0);
  const [driftInfo, setDriftInfo] = useState('');

  const peerRef = useRef<any>(null);
  const connsRef = useRef<any[]>([]);
  const myIdRef = useRef('');
  const suppressUntilRef = useRef(0);
  const lastHrefRef = useRef(
    typeof location !== 'undefined' ? location.href : ''
  );
  const roleRef = useRef<Role>('idle');
  const roomRef = useRef('');
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalLeaveRef = useRef(false);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const isSuppressed = () => Date.now() < suppressUntilRef.current;
  const bumpSuppress = (ms = 500) => {
    suppressUntilRef.current = Date.now() + ms;
  };

  const broadcast = useCallback((msg: Omit<SyncMsg, 'source' | 'from'>) => {
    const full: SyncMsg = {
      ...msg,
      source: 'ricktv1-couple',
      from: myIdRef.current,
      href: typeof location !== 'undefined' ? location.href : undefined,
      ts: Date.now(),
    };
    connsRef.current.forEach((c) => {
      try {
        if (c.open) c.send(full);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const applyCatchup = useCallback(
    (remoteT: number, playing?: boolean) => {
      const local = getPlayback().currentTime || 0;
      const drift = remoteT - local;
      const abs = Math.abs(drift);
      if (abs < CATCHUP_SOFT) {
        setDriftInfo('');
        return;
      }
      setDriftInfo(`追帧 ${drift > 0 ? '+' : ''}${drift.toFixed(1)}s`);
      bumpSuppress(abs > CATCHUP_HARD ? 800 : 400);
      applyCmd('seek', remoteT);
      if (playing === true) applyCmd('play', remoteT);
      if (playing === false) applyCmd('pause', remoteT);
    },
    [applyCmd, getPlayback]
  );

  const handleRemote = useCallback(
    (data: SyncMsg) => {
      if (!data || data.source !== 'ricktv1-couple') return;
      if (data.from && data.from === myIdRef.current) return;

      // 同链：对方换片/换源后带着新 href
      if (
        data.href &&
        typeof location !== 'undefined' &&
        !sameWatchUrl(data.href, location.href) &&
        (data.action === 'navigate' ||
          data.action === 'heartbeat' ||
          data.action === 'play' ||
          data.action === 'pause' ||
          data.action === 'state')
      ) {
        bumpSuppress(1500);
        setStatus('跟随对方跳转…');
        location.assign(data.href);
        return;
      }

      if (isSuppressed() && data.action !== 'hello') return;

      bumpSuppress(450);
      try {
        if (data.action === 'play') {
          applyCmd('play', data.t);
          if (typeof data.t === 'number') applyCatchup(data.t, true);
        } else if (data.action === 'pause') {
          applyCmd('pause', data.t);
          if (typeof data.t === 'number') applyCatchup(data.t, false);
        } else if (data.action === 'seek' && typeof data.t === 'number') {
          applyCmd('seek', data.t);
        } else if (data.action === 'heartbeat' || data.action === 'state') {
          if (typeof data.t === 'number') {
            applyCatchup(data.t, data.playing);
          }
        } else if (data.action === 'navigate' && data.href) {
          if (!sameWatchUrl(data.href, location.href)) {
            location.assign(data.href);
          }
        } else if (data.action === 'hello') {
          const st = getPlayback();
          broadcast({
            action: st.playing ? 'play' : 'pause',
            t: st.currentTime,
            playing: st.playing,
          });
        }
      } finally {
        /* suppress window already set */
      }
    },
    [applyCatchup, applyCmd, broadcast, getPlayback]
  );

  const scheduleGuestReconnect = useCallback(() => {
    if (intentionalLeaveRef.current) return;
    if (roleRef.current !== 'guest') return;
    const code = roomRef.current;
    if (!code) return;
    if (reconnectAttemptsRef.current >= 8) {
      setStatus('重连失败，请手动再加入');
      return;
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    const attempt = reconnectAttemptsRef.current + 1;
    reconnectAttemptsRef.current = attempt;
    const delay = Math.min(10000, 1000 * attempt);
    setStatus(`连接断开，${Math.round(delay / 1000)}s 后重连 (${attempt}/8)…`);
    reconnectTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          setStatus(`重连中 (${attempt}/8)…`);
          const Peer = await loadPeerCtor();
          try {
            peerRef.current?.destroy();
          } catch {
            /* ignore */
          }
          const id = `ricktv1-guest-${genCode()}`;
          myIdRef.current = id;
          const peer = new Peer(id);
          peerRef.current = peer;
          peer.on('open', () => {
            const conn = peer.connect(`ricktv1-${code}`, { reliable: true });
            wireConnRef.current?.(conn);
            setStatus('重连中…');
          });
          peer.on('error', () => {
            scheduleGuestReconnect();
          });
          peer.on('disconnected', () => {
            try {
              peer.reconnect();
            } catch {
              scheduleGuestReconnect();
            }
          });
        } catch {
          scheduleGuestReconnect();
        }
      })();
    }, delay);
  }, []);

  const wireConnRef = useRef<((conn: any) => void) | null>(null);

  const wireConn = useCallback(
    (conn: any) => {
      conn.on('open', () => {
        reconnectAttemptsRef.current = 0;
        setPeerCount((n) => n + 1);
        setStatus('已同步');
        conn.send({
          source: 'ricktv1-couple',
          action: 'hello',
          from: myIdRef.current,
          href: location.href,
          ts: Date.now(),
        } as SyncMsg);
      });
      conn.on('data', (data: SyncMsg) => handleRemote(data));
      conn.on('close', () => {
        connsRef.current = connsRef.current.filter((c) => c !== conn);
        setPeerCount((n) => Math.max(0, n - 1));
        if (connsRef.current.some((c) => c.open)) {
          setStatus('已同步');
        } else if (roleRef.current === 'guest') {
          setStatus('对方断开');
          scheduleGuestReconnect();
        } else {
          setStatus('等待对方加入');
        }
      });
      connsRef.current.push(conn);
    },
    [handleRemote, scheduleGuestReconnect]
  );

  wireConnRef.current = wireConn;

  const cleanup = useCallback(() => {
    intentionalLeaveRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    connsRef.current.forEach((c) => {
      try {
        c.close();
      } catch {
        /* ignore */
      }
    });
    connsRef.current = [];
    try {
      peerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    peerRef.current = null;
    setPeerCount(0);
    setRole('idle');
    setRoom('');
    setStatus('未连接');
    setDriftInfo('');
  }, []);

  // 本页 URL 变化 → 广播 navigate（换源/换集）
  useEffect(() => {
    if (role === 'idle') return;
    const timer = setInterval(() => {
      if (typeof location === 'undefined') return;
      if (location.href !== lastHrefRef.current) {
        lastHrefRef.current = location.href;
        if (!isSuppressed()) {
          broadcast({ action: 'navigate', href: location.href });
        }
      }
    }, 600);
    return () => clearInterval(timer);
  }, [role, broadcast]);

  // 弱网追帧：周期性 heartbeat（房主主发；成员也可发，对端用偏差判定）
  useEffect(() => {
    if (role === 'idle') return;
    const timer = setInterval(() => {
      if (isSuppressed()) return;
      if (!connsRef.current.some((c) => c.open)) return;
      const st = getPlayback();
      broadcast({
        action: 'heartbeat',
        t: st.currentTime,
        playing: st.playing,
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [role, broadcast, getPlayback]);

  // hash #couple=CODE 自动加入
  useEffect(() => {
    if (typeof location === 'undefined') return;
    const m = location.hash.match(/couple=([A-Z0-9]+)/i);
    if (m?.[1] && role === 'idle') {
      setJoinInput(m[1].toUpperCase());
    }
  }, [role]);

  const createRoom = async () => {
    try {
      intentionalLeaveRef.current = false;
      reconnectAttemptsRef.current = 0;
      setStatus('创建中…');
      const Peer = await loadPeerCtor();
      const code = genCode();
      const id = `ricktv1-${code}`;
      myIdRef.current = id;
      const peer = new Peer(id);
      peerRef.current = peer;
      peer.on('open', () => {
        setRoom(code);
        setRole('host');
        setStatus('等待对方加入');
        lastHrefRef.current = location.href;
      });
      peer.on('connection', (conn: any) => wireConn(conn));
      peer.on('disconnected', () => {
        setStatus('信令断开，尝试恢复…');
        try {
          peer.reconnect();
        } catch {
          setStatus('信令断开，请重建房间');
        }
      });
      peer.on('error', (err: any) => {
        setStatus(`错误: ${err?.type || err?.message || 'unknown'}`);
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '创建失败');
    }
  };

  const joinRoom = async (codeOverride?: string) => {
    const code = (codeOverride || joinInput).trim().toUpperCase();
    if (code.length < 4) {
      setStatus('请输入房间码');
      return;
    }
    try {
      intentionalLeaveRef.current = false;
      reconnectAttemptsRef.current = 0;
      setStatus('加入中…');
      const Peer = await loadPeerCtor();
      const id = `ricktv1-guest-${genCode()}`;
      myIdRef.current = id;
      const peer = new Peer(id);
      peerRef.current = peer;
      peer.on('open', () => {
        const conn = peer.connect(`ricktv1-${code}`, { reliable: true });
        wireConn(conn);
        setRoom(code);
        setRole('guest');
        setStatus('连接中…');
        lastHrefRef.current = location.href;
      });
      peer.on('disconnected', () => {
        setStatus('信令断开，尝试恢复…');
        try {
          peer.reconnect();
        } catch {
          scheduleGuestReconnect();
        }
      });
      peer.on('error', (err: any) => {
        setStatus(`错误: ${err?.type || err?.message || 'unknown'}`);
        if (roleRef.current === 'guest') scheduleGuestReconnect();
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '加入失败');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__coupleNestEmit = (
      action: 'play' | 'pause' | 'seek' | 'navigate',
      t?: number
    ) => {
      if (isSuppressed() || roleRef.current === 'idle') return;
      const st = getPlayback();
      if (action === 'navigate') {
        broadcast({ action: 'navigate', href: location.href });
        return;
      }
      broadcast({
        action,
        t: typeof t === 'number' ? t : st.currentTime,
        playing:
          action === 'play' ? true : action === 'pause' ? false : st.playing,
      });
    };
    return () => {
      delete (window as any).__coupleNestEmit;
    };
  }, [broadcast, getPlayback]);

  const copyInvite = async () => {
    const url = `${location.origin}${location.pathname}${location.search}#couple=${room}`;
    try {
      await navigator.clipboard.writeText(`${room}\n${url}`);
      setStatus('已复制房间码与链接');
    } catch {
      setStatus(`房间码 ${room}`);
    }
  };

  if (!open) return null;

  return (
    <div className='absolute bottom-24 left-4 z-[85] w-[min(100%-2rem,20rem)]'>
      <div className='rounded-2xl border border-teal-400/30 bg-slate-950/90 backdrop-blur-md shadow-2xl shadow-teal-950/40 p-4 text-slate-100'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <Users className='h-4 w-4 text-teal-400' />
            <span className='font-display text-sm font-semibold'>
              Couple Nest
            </span>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1 rounded-lg hover:bg-white/10'
            aria-label='关闭'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <p className='text-[11px] text-slate-400 mb-3 leading-relaxed'>
          播停 / 进度 / 同页跳转 / 弱网追帧都会同步。
        </p>

        {role === 'idle' ? (
          <div className='space-y-2'>
            <button
              type='button'
              onClick={createRoom}
              className='w-full rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm py-2.5'
            >
              创建房间
            </button>
            <div className='flex gap-2'>
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder='输入房间码'
                maxLength={8}
                className='flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-teal-400'
              />
              <button
                type='button'
                onClick={() => joinRoom()}
                className='rounded-xl border border-teal-400/40 px-3 text-sm text-teal-200 hover:bg-teal-500/20'
              >
                <Link2 className='h-4 w-4' />
              </button>
            </div>
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2'>
              <div className='min-w-0'>
                <p className='text-[10px] uppercase tracking-wider text-slate-500'>
                  {role === 'host' ? '房主' : '成员'} · {peerCount} 人在线
                </p>
                <p className='font-display text-xl tracking-[0.3em] text-teal-300'>
                  {room}
                </p>
              </div>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(
                  `${typeof location !== 'undefined' ? location.origin : ''}${typeof location !== 'undefined' ? location.pathname : ''}${typeof location !== 'undefined' ? location.search : ''}#couple=${room}`
                )}`}
                alt='房间二维码'
                width={72}
                height={72}
                className='rounded-lg bg-white p-0.5 shrink-0'
                referrerPolicy='no-referrer'
              />
              <button
                type='button'
                onClick={copyInvite}
                className='p-2 rounded-lg border border-white/10 hover:border-teal-400/40 shrink-0'
                title='复制邀请'
              >
                <Copy className='h-4 w-4 text-teal-300' />
              </button>
            </div>
            <button
              type='button'
              onClick={cleanup}
              className='w-full text-xs text-slate-400 hover:text-red-400 py-1'
            >
              离开房间
            </button>
          </div>
        )}

        <p className='mt-3 text-[11px] text-slate-500'>{status}</p>
        {driftInfo && (
          <p className='text-[11px] text-amber-300/90 mt-1'>{driftInfo}</p>
        )}
      </div>
    </div>
  );
}
