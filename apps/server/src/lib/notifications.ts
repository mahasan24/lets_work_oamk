import { db } from "@lets_work/db";
import { notification, type notificationTypeEnum } from "@lets_work/db/schema/notifications";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
};

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
