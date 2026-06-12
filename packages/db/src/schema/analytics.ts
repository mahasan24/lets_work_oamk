import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    eventName: text("event_name").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    properties: jsonb("properties"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("analytics_event_user_id_idx").on(table.userId)],
);
