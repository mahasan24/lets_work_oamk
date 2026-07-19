import { Elysia, t } from "elysia";

import {
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationNotFoundError,
} from "../lib/notifications";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

type ErrorResponse = { status: number; body: { error: string } };

function handleNotificationError(error: unknown): ErrorResponse | null {
  if (error instanceof NotificationNotFoundError) {
    return { status: 404, body: { error: error.message } };
  }
  return null;
}

async function runNotificationAction<T>(action: () => Promise<T>) {
  try {
    return { ok: true as const, data: await action() };
  } catch (error) {
    const mapped = handleNotificationError(error);
    if (mapped) {
      return { ok: false as const, status: mapped.status, body: mapped.body };
    }
    throw error;
  }
}

export const notificationRoutes = new Elysia({
  prefix: "/api/notifications",
  detail: {
    tags: ["Notifications"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runNotificationAction(() =>
        listUserNotifications(user.id, {
          unreadOnly: query.unreadOnly,
          limit: query.limit,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        unreadOnly: t.Optional(t.Boolean()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "List notifications",
        description: "Recent in-app notifications for the authenticated user.",
      },
    },
  )
  .get(
    "/unread-count",
    async ({ user, status }) => {
      const result = await runNotificationAction(() => getUnreadNotificationCount(user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: { summary: "Get unread notification count" },
    },
  )
  .post(
    "/read-all",
    async ({ user, status }) => {
      const result = await runNotificationAction(() => markAllNotificationsRead(user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      detail: { summary: "Mark all notifications as read" },
    },
  )
  .post(
    "/:id/read",
    async ({ user, params, status }) => {
      const result = await runNotificationAction(() =>
        markNotificationRead(params.id, user.id),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Mark a notification as read" },
    },
  );
