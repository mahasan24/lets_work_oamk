import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contract } from "./contracts";
import { milestone } from "./milestones";

export const contractEventTypeEnum = pgEnum("contract_event_type", [
  "created",
  "activated",
  "paused",
  "resumed",
  "milestone_created",
  "milestone_started",
  "milestone_submitted",
  "milestone_approved",
  "milestone_revision_requested",
  "completed",
  "cancelled",
  "disputed",
]);

export const contractEvent = pgTable(
  "contract_event",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    eventType: contractEventTypeEnum("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    milestoneId: text("milestone_id").references(() => milestone.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("contract_event_contract_id_idx").on(table.contractId),
    index("contract_event_created_at_idx").on(table.createdAt),
  ],
);
