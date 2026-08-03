import { getRedis } from "@lets_work/auth";
import { Elysia } from "elysia";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 180;
const AUTH_PREFIX = "/api/auth";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Redis-backed API rate limit for non-auth routes.
 * Auth routes are covered by Better Auth rateLimit + secondary storage.
 */
export const apiRateLimitPlugin = new Elysia({ name: "api-rate-limit" }).onBeforeHandle(
  { as: "global" },
  async ({ request, set }) => {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/") || path.startsWith(AUTH_PREFIX)) {
      return;
    }

    try {
      const redis = await getRedis();
      const ip = clientIp(request);
      const key = `rl:api:${ip}:${Math.floor(Date.now() / (WINDOW_SECONDS * 1000))}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }

      set.headers["X-RateLimit-Limit"] = String(MAX_REQUESTS);
      set.headers["X-RateLimit-Remaining"] = String(Math.max(0, MAX_REQUESTS - count));

      if (count > MAX_REQUESTS) {
        set.status = 429;
        return {
          error: "Too many requests. Please try again shortly.",
          code: "RATE_LIMITED",
        };
      }
    } catch (error) {
      // Fail open if Redis is briefly unavailable; auth still has its own limits.
      console.error("[rate-limit] redis unavailable", error);
    }
  },
);
