import { pgEnum, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const notificationTypeEnum = pgEnum("notification_type", [
  "system",
  "message",
  "job",
  "proposal",
  "contract",
  "payment",
  "review",
  "report",
]);

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    actionUrl: text("action_url"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_id_idx").on(table.userId),
    index("notification_read_at_idx").on(table.readAt),
  ],
);
