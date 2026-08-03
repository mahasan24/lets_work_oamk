import { getRedis } from "@lets_work/auth";
import type { RedisClientType } from "redis";

/** Minimal shape of an Elysia WebSocket connection we depend on. */
export type RealtimeSocket = {
  readonly id: string;
  send: (data: string) => unknown;
};

export type RealtimeEvent = {
  type: string;
  payload: unknown;
};

const connectionsByUser = new Map<string, Map<string, RealtimeSocket>>();
const REALTIME_CHANNEL = "letswork:realtime:user-events";
const INSTANCE_ID = crypto.randomUUID();

type BroadcastEnvelope = {
  source: string;
  userId: string;
  event: RealtimeEvent;
};

let publisher: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;
let redisReady = false;
let redisInitPromise: Promise<void> | null = null;

async function ensureRedisBus() {
  if (redisReady) return;
  if (redisInitPromise) {
    await redisInitPromise;
    return;
  }

  redisInitPromise = (async () => {
    try {
      const shared = await getRedis();
      publisher = shared;
      subscriber = shared.duplicate();

      publisher.on("error", () => {
        redisReady = false;
      });
      subscriber.on("error", () => {
        redisReady = false;
      });

      if (!subscriber.isOpen) {
        await subscriber.connect();
      }

      await subscriber.subscribe(REALTIME_CHANNEL, (payload) => {
        try {
          const parsed = JSON.parse(payload) as BroadcastEnvelope;
          if (parsed.source === INSTANCE_ID) return;
          deliverToUser(parsed.userId, parsed.event);
        } catch {
          // Ignore malformed pub/sub payloads.
        }
      });
      redisReady = true;
    } catch (error) {
      redisReady = false;
      console.error("[realtime] failed to connect Redis pub/sub", error);
    }
  })();

  await redisInitPromise;
}

function publishOverRedis(userId: string, event: RealtimeEvent) {
  void ensureRedisBus().then(async () => {
    if (!publisher || !redisReady) return;
    const envelope: BroadcastEnvelope = {
      source: INSTANCE_ID,
      userId,
      event,
    };
    await publisher.publish(REALTIME_CHANNEL, JSON.stringify(envelope));
  });
}

export function registerConnection(userId: string, socket: RealtimeSocket) {
  void ensureRedisBus();
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

export function publishToUser(userId: string, event: RealtimeEvent) {
  deliverToUser(userId, event);
  publishOverRedis(userId, event);
}
