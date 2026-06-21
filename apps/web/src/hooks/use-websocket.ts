'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api-client';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  autoConnect?: boolean;
}

export function useWebSocket({ url, onMessage, autoConnect = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const token = getAccessToken();
    const wsUrl = `${url}${url.includes('?') ? '&' : '?'}token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch { /* ignore non-JSON */ }
    };

    wsRef.current = ws;
  }, [url, onMessage]);

  const send = useCallback((event: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data: payload }));
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => { wsRef.current?.close(); };
  }, [autoConnect, connect]);

  return { connected, send, disconnect, connect };
}
