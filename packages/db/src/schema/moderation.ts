import { pgEnum, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { job, proposal } from "./jobs";
import { message } from "./chat";

export const reportTypeEnum = pgEnum("report_type", [
  "spam",
  "fraud",
  "harassment",
  "abuse",
  "other",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "under_review",
  "resolved",
  "dismissed",
]);

export const report = pgTable(
  "report",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reportedUserId: text("reported_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    reportedJobId: text("reported_job_id").references(() => job.id, {
      onDelete: "cascade",
    }),
    reportedProposalId: text("reported_proposal_id").references(
      () => proposal.id,
      { onDelete: "cascade" },
    ),
    reportedMessageId: text("reported_message_id").references(
      () => message.id,
      { onDelete: "cascade" },
    ),
    reportType: reportTypeEnum("report_type").notNull(),
    description: text("description").notNull(),
    status: reportStatusEnum("status").default("open").notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("report_reporter_id_idx").on(table.reporterId)],
);
