import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { job, proposal } from "./jobs";

export const contractTypeEnum = pgEnum("contract_type", ["hourly", "one_time"]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
]);

export const contract = pgTable(
  "contract",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").references(() => job.id, { onDelete: "set null" }),
    proposalId: text("proposal_id").references(() => proposal.id, {
      onDelete: "set null",
    }),
    hirerUserId: text("hirer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    freelancerUserId: text("freelancer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    scope: text("scope").notNull(),
    contractType: contractTypeEnum("contract_type").notNull(),
    status: contractStatusEnum("status").default("draft").notNull(),
    hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }),
    fixedAmount: numeric("fixed_amount", { precision: 12, scale: 2 }),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("contract_hirer_user_id_idx").on(table.hirerUserId),
    index("contract_freelancer_user_id_idx").on(table.freelancerUserId),
    index("contract_job_id_idx").on(table.jobId),
  ],
);
