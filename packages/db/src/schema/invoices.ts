import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contract } from "./contracts";
import { milestone } from "./milestones";
import { payment } from "./payments";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "void",
  "overdue",
]);

export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    contractId: text("contract_id").references(() => contract.id, {
      onDelete: "set null",
    }),
    milestoneId: text("milestone_id").references(() => milestone.id, {
      onDelete: "set null",
    }),
    paymentId: text("payment_id").references(() => payment.id, {
      onDelete: "set null",
    }),
    billedToUserId: text("billed_to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    billedFromUserId: text("billed_from_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    platformFee: numeric("platform_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("USD").notNull(),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("invoice_billed_to_user_id_idx").on(table.billedToUserId),
    index("invoice_contract_id_idx").on(table.contractId),
  ],
);
