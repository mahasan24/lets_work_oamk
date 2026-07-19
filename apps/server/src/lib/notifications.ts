import { db } from "@lets_work/db";
import { notification, type notificationTypeEnum } from "@lets_work/db/schema/notifications";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
};

export class NotificationNotFoundError extends Error {
  constructor() {
    super("Notification not found");
    this.name = "NotificationNotFoundError";
  }
}

function serializeNotification(row: typeof notification.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actionUrl: row.actionUrl,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export async function createNotification(input: CreateNotificationInput) {
  const [created] = await db
    .insert(notification)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      actionUrl: input.actionUrl ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create notification");
  }

  return created;
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return [];

  return db
    .insert(notification)
    .values(
      inputs.map((input) => ({
        id: crypto.randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
      })),
    )
    .returning();
}

export async function listUserNotifications(
  userId: string,
  query?: { unreadOnly?: boolean; limit?: number },
) {
  const limit = Math.min(Math.max(query?.limit ?? 20, 1), 50);
  const conditions = [eq(notification.userId, userId)];

  if (query?.unreadOnly) {
    conditions.push(isNull(notification.readAt));
  }

  const rows = await db
    .select()
    .from(notification)
    .where(and(...conditions))
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

  return {
    items: rows.map(serializeNotification),
    meta: {
      unreadCount: Number(unread?.count ?? 0),
      total: rows.length,
    },
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

  return { unreadCount: Number(row?.count ?? 0) };
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .returning();

  if (!updated) {
    throw new NotificationNotFoundError();
  }

  return serializeNotification(updated);
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

  return getUnreadNotificationCount(userId);
}
