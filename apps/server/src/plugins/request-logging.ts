import { env } from "@lets_work/env/server";
import { Elysia } from "elysia";
import pino from "pino";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
});

type RequestLogState = {
  requestId: string;
  startedAt: number;
};

/**
 * Structured request logging with request IDs.
 * Sets `X-Request-Id` on every response.
 */
export const requestLoggingPlugin = new Elysia({ name: "request-logging" })
  .derive({ as: "global" }, ({ request }) => {
    const incoming = request.headers.get("x-request-id");
    const requestId =
      incoming && incoming.trim().length > 0 ? incoming.trim() : crypto.randomUUID();
    return {
      requestLog: {
        requestId,
        startedAt: Date.now(),
      } satisfies RequestLogState,
    };
  })
  .onBeforeHandle({ as: "global" }, ({ request, requestLog, set }) => {
    set.headers["X-Request-Id"] = requestLog.requestId;
    logger.debug(
      {
        requestId: requestLog.requestId,
        method: request.method,
        path: new URL(request.url).pathname,
      },
      "request start",
    );
  })
  .onAfterResponse({ as: "global" }, ({ request, requestLog, set }) => {
    const durationMs = Date.now() - requestLog.startedAt;
    const path = new URL(request.url).pathname;
    // Skip noisy health/docs chatter in production logs
    if (env.NODE_ENV === "production" && (path === "/" || path.startsWith("/openapi"))) {
      return;
    }
    logger.info(
      {
        requestId: requestLog.requestId,
        method: request.method,
        path,
        status: typeof set.status === "number" ? set.status : 200,
        durationMs,
      },
      "request completed",
    );
  })
  .onError({ as: "global" }, ({ request, requestLog, error, set }) => {
    if (!requestLog) return;
    logger.error(
      {
        requestId: requestLog.requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status: typeof set.status === "number" ? set.status : 500,
        err: error,
      },
      "request failed",
    );
  });
