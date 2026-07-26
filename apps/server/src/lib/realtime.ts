/**
 * Realtime gateway hub.
 *
 * Tracks live WebSocket connections per user and fans out events to every
 * device a user has open. The rest of the app pushes updates through
 * {@link publishToUser} (e.g. when a notification is created) so clients receive
 * changes without polling.
 *
 * This implementation keeps connections in process memory, which is correct for
 * a single server instance. For horizontal scaling, `broadcast` is the single
 * choke point to layer a Redis (or other) pub/sub fan-out on top of — publish
 * the event to every instance there and have each call {@link deliverToUser}.
 */

/** Minimal shape of an Elysia WebSocket connection we depend on. */
export type RealtimeSocket = {
  readonly id: string;
  send: (data: string) => unknown;
};

export type RealtimeEvent = {
  /** Stable event name, e.g. `notification:new`. */
  type: string;
  payload: unknown;
};

const connectionsByUser = new Map<string, Map<string, RealtimeSocket>>();

export function registerConnection(userId: string, socket: RealtimeSocket) {
  let sockets = connectionsByUser.get(userId);
  if (!sockets) {
    sockets = new Map();
    connectionsByUser.set(userId, sockets);
  }
  sockets.set(socket.id, socket);
}

export function unregisterConnection(userId: string, socketId: string) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    connectionsByUser.delete(userId);
  }
}

/** Number of live connections for a user (useful for tests/diagnostics). */
export function connectionCount(userId: string) {
  return connectionsByUser.get(userId)?.size ?? 0;
}

/** Delivers an event to a user's connections on this instance only. */
export function deliverToUser(userId: string, event: RealtimeEvent) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets || sockets.size === 0) return;

  const message = JSON.stringify(event);
  for (const socket of sockets.values()) {
    try {
      socket.send(message);
    } catch {
      // Drop broken sockets; `close` will clean up the registry.
    }
  }
}

/**
 * Publishes an event to a user across the deployment. Today this is a local
 * delivery; wire a pub/sub adapter here to reach other instances.
 */
export function publishToUser(userId: string, event: RealtimeEvent) {
  deliverToUser(userId, event);
}
