import { env } from "@lets_work/env/web";

/**
 * Thin client for the server's realtime gateway (`/api/ws`).
 *
 * A single shared WebSocket is opened lazily when the first subscriber attaches
 * and closed once the last one leaves. The session cookie is sent automatically
 * on the upgrade request (same origin as the API), so no token handling is
 * needed here. Reconnection uses capped exponential backoff.
 */

type RealtimeMessage = { type: string; payload: unknown };
type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
let shouldConnect = false;

function getSocketUrl() {
  const base = env.VITE_SERVER_URL.replace(/^http/, "ws").replace(/\/$/, "");
  return `${base}/api/ws`;
}

function dispatch(message: RealtimeMessage) {
  const handlers = listeners.get(message.type);
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      handler(message.payload);
    } catch {
      // A misbehaving subscriber shouldn't take down the socket.
    }
  }
}

function scheduleReconnect() {
  if (!shouldConnect || reconnectTimer != null) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
  reconnectAttempts += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (typeof window === "undefined" || !shouldConnect) return;
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  try {
    socket = new WebSocket(getSocketUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  socket.addEventListener("open", () => {
    reconnectAttempts = 0;
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      dispatch(JSON.parse(event.data) as RealtimeMessage);
    } catch {
      // Ignore non-JSON frames.
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });
}

function teardown() {
  shouldConnect = false;
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  socket?.close();
  socket = null;
}

/**
 * Subscribes to a realtime event type. Returns an unsubscribe function that
 * also closes the socket when no subscribers remain.
 */
export function subscribeToRealtime(type: string, handler: Handler) {
  let handlers = listeners.get(type);
  if (!handlers) {
    handlers = new Set();
    listeners.set(type, handlers);
  }
  handlers.add(handler);

  shouldConnect = true;
  connect();

  return () => {
    const current = listeners.get(type);
    if (current) {
      current.delete(handler);
      if (current.size === 0) listeners.delete(type);
    }
    if (listeners.size === 0) {
      teardown();
    }
  };
}
