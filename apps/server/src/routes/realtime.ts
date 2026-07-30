import { Elysia } from "elysia";

import { publishTypingState } from "../lib/chat";
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
    async message(ws, message) {
      // Lightweight keep-alive so proxies don't drop idle connections.
      if (message === "ping") {
        ws.send(JSON.stringify({ type: "pong", payload: null }));
        return;
      }

      if (typeof message !== "string") return;
      try {
        const parsed = JSON.parse(message) as {
          type?: string;
          payload?: { conversationId?: string; isTyping?: boolean };
        };
        if (parsed.type !== "chat:typing") return;
        const conversationId = parsed.payload?.conversationId?.trim();
        if (!conversationId) return;
        await publishTypingState(
          ws.data.user.id,
          conversationId,
          Boolean(parsed.payload?.isTyping),
        );
      } catch {
        // Ignore malformed or unsupported websocket payloads.
      }
    },
    close(ws) {
      unregisterConnection(ws.data.user.id, ws.id);
    },
  });
