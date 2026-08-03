import { env } from "@lets_work/env/server";
import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

/**
 * Shared Redis client for Better Auth secondary storage and server features.
 * Connects lazily so module import stays safe during builds.
 */
export async function getRedis(): Promise<RedisClientType> {
  if (client?.isOpen) return client;

  if (!connectPromise) {
    connectPromise = (async () => {
      const next = createClient({ url: env.REDIS_URL });
      next.on("error", (error) => {
        console.error("[redis] client error", error);
      });
      await next.connect();
      client = next;
      return next;
    })().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}

export function createRedisSecondaryStorage() {
  return {
    async get(key: string) {
      try {
        const redis = await getRedis();
        return await redis.get(key);
      } catch (error) {
        console.error("[redis] get failed", error);
        return null;
      }
    },
    async set(key: string, value: string, ttl?: number) {
      try {
        const redis = await getRedis();
        if (ttl) {
          await redis.set(key, value, { EX: ttl });
        } else {
          await redis.set(key, value);
        }
      } catch (error) {
        console.error("[redis] set failed", error);
      }
    },
    async delete(key: string) {
      try {
        const redis = await getRedis();
        await redis.del(key);
      } catch (error) {
        console.error("[redis] delete failed", error);
      }
    },
  };
}
