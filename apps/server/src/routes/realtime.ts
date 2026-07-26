import { Elysia } from "elysia";

import { registerConnection, unregisterConnection } from "../lib/realtime";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

/**
 * Authenticated realtime gateway. Clients connect once and receive pushed
 * events (notifications, etc.) for the duration of the session. Authentication
 * reuses the Better Auth session cookie via the `auth` macro, so unauthenticated
 * upgrades are rejected before `open` runs.
 */
export const realtimeRoutes = new Elysia({
  detail: {
    tags: ["Realtime"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .ws("/api/ws", {
    auth: true,
    open(ws) {
      const userId = ws.data.user.id;
      registerConnection(userId, ws);
      ws.send(JSON.stringify({ type: "connected", payload: { userId } }));
    },
    message(ws, message) {
      // Lightweight keep-alive so proxies don't drop idle connections.
      if (message === "ping") {
        ws.send(JSON.stringify({ type: "pong", payload: null }));
      }
    },
    close(ws) {
      unregisterConnection(ws.data.user.id, ws.id);
    },
  });
