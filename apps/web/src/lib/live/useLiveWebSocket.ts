'use client';

/**
 * useLiveWebSocket — hook React pour s'abonner au flux d'événements live.
 *
 * Reconnexion automatique avec back-off exponentiel 1s → 15s.
 * Port TS strict du hook du dépôt B (`frontend/src/lib/useLiveWebSocket.js`).
 *
 * Usage :
 *   const { connected, lastEvent } = useLiveWebSocket((event) => {
 *     if (event.type === 'match_completed') refresh();
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveEvent } from '@tt/types';

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/api/ws/live';

export interface UseLiveWebSocketResult {
  connected: boolean;
  lastEvent: LiveEvent | null;
  reconnect: () => void;
}

export function useLiveWebSocket(
  onEvent?: (event: LiveEvent) => void,
  options?: { token?: string; url?: string; enabled?: boolean },
): UseLiveWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const buildUrl = useCallback(() => {
    const base = options?.url ?? DEFAULT_WS_URL;
    if (!options?.token) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}token=${encodeURIComponent(options.token)}`;
  }, [options?.token, options?.url]);

  const connect = useCallback(() => {
    if (closedRef.current) return;
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(buildUrl());
    } catch {
      const delay = Math.min(15_000, 1000 * Math.pow(2, retryRef.current));
      retryRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as LiveEvent;
        setLastEvent(data);
        onEventRef.current?.(data);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (closedRef.current) return;
      const delay = Math.min(15_000, 1000 * Math.pow(2, retryRef.current));
      retryRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [buildUrl]);

  const reconnect = useCallback(() => {
    closedRef.current = false;
    retryRef.current = 0;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    connect();
  }, [connect]);

  useEffect(() => {
    if (options?.enabled === false) return;
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.enabled]);

  return { connected, lastEvent, reconnect };
}
