import { pgEnum, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contract } from "./contracts";
import { milestone } from "./milestones";

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "under_review",
  "resolved_client",
  "resolved_freelancer",
  "closed",
]);

export const dispute = pgTable(
  "dispute",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id").references(() => milestone.id, {
      onDelete: "set null",
    }),
    openedByUserId: text("opened_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    respondentUserId: text("respondent_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").default("open").notNull(),
    resolution: text("resolution"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("dispute_contract_id_idx").on(table.contractId),
    index("dispute_status_idx").on(table.status),
  ],
);
