import { browser } from "$app/environment";

export type RealtimeHandler = (event: {
  type: string;
  queueId?: string;
  payload?: unknown;
  timestamp?: string;
}) => void;

/**
 * Lightweight WebSocket client with auto-reconnect.
 * Uses same-origin /ws (proxied in dev).
 */
export function createRealtime(onEvent: RealtimeHandler) {
  if (!browser) {
    return {
      subscribe: (_queueId: string) => {},
      unsubscribe: (_queueId: string) => {},
      close: () => {},
      get connected() {
        return false;
      },
    };
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 500;
  const subscriptions = new Set<string>();

  function url() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const base = import.meta.env.PUBLIC_WS_URL as string | undefined;
    if (base) return base;
    return `${proto}//${location.host}/ws`;
  }

  function connect() {
    if (closed) return;
    ws = new WebSocket(url());

    ws.onopen = () => {
      retryMs = 500;
      for (const queueId of subscriptions) {
        ws?.send(JSON.stringify({ type: "subscribe", queueId }));
      }
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // Ignore noise that must not trigger UI reloads
        if (
          data?.type === "connected" ||
          data?.type === "pong" ||
          data?.type === "subscribed"
        ) {
          return;
        }
        onEvent(data);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      ws = null;
      if (closed) return;
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 1.6, 8000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return {
    subscribe(queueId: string) {
      subscriptions.add(queueId);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "subscribe", queueId }));
      }
    },
    unsubscribe(queueId: string) {
      subscriptions.delete(queueId);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", queueId }));
      }
    },
    close() {
      closed = true;
      ws?.close();
    },
    get connected() {
      return ws?.readyState === WebSocket.OPEN;
    },
  };
}
