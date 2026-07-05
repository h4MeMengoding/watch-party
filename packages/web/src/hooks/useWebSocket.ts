import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerEvent, ClientEvent } from '@watch-together/shared';
import { WS_PORT } from '@watch-together/shared';

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://localhost:${WS_PORT}`;

type Status = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useWebSocket(onEvent: (evt: ServerEvent) => void) {
  const [status, setStatus] = useState<Status>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const mountedRef = useRef(true);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => { retryRef.current = 0; setStatus('connected'); };
    ws.onmessage = (e) => {
      try { handlerRef.current(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('reconnecting');
      const delay = Math.min(1000 * 2 ** retryRef.current, 10_000);
      retryRef.current++;
      setTimeout(() => { if (mountedRef.current) connect(); }, delay);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => { mountedRef.current = false; wsRef.current?.close(); };
  }, [connect]);

  const send = useCallback((evt: ClientEvent) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(evt));
  }, []);

  return { status, send };
}
