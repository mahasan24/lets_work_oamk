import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contract } from "./contracts";

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "pending",
  "funded",
  "in_progress",
  "submitted",
  "revision_requested",
  "approved",
  "released",
  "disputed",
  "cancelled",
]);

export const milestone = pgTable(
  "milestone",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("USD").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    status: milestoneStatusEnum("status").default("pending").notNull(),
    dueDate: timestamp("due_date"),
    submittedAt: timestamp("submitted_at"),
    approvedAt: timestamp("approved_at"),
    releasedAt: timestamp("released_at"),
    revisionNote: text("revision_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("milestone_contract_id_idx").on(table.contractId),
    index("milestone_status_idx").on(table.status),
  ],
);

export const milestoneSubmission = pgTable(
  "milestone_submission",
  {
    id: text("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestone.id, { onDelete: "cascade" }),
    submittedByUserId: text("submitted_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note"),
    attachmentUrl: text("attachment_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("milestone_submission_milestone_id_idx").on(table.milestoneId)],
);
