import {
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  index,
  jsonb,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contract } from "./contracts";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "held",
  "succeeded",
  "refunded",
  "failed",
]);

export const stripeCustomer = pgTable(
  "stripe_customer",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("stripe_customer_user_id_idx").on(table.userId)],
);

export const stripeConnectAccount = pgTable(
  "stripe_connect_account",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeAccountId: text("stripe_account_id").notNull().unique(),
    chargesEnabled: boolean("charges_enabled").default(false).notNull(),
    payoutsEnabled: boolean("payouts_enabled").default(false).notNull(),
    detailsSubmitted: boolean("details_submitted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("stripe_connect_account_user_id_idx").on(table.userId)],
);

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").references(() => contract.id, {
      onDelete: "set null",
    }),
    payerUserId: text("payer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    payeeUserId: text("payee_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: paymentStatusEnum("status").default("pending").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("USD").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripeChargeId: text("stripe_charge_id").unique(),
    stripeTransferId: text("stripe_transfer_id").unique(),
    description: text("description"),
    paidAt: timestamp("paid_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("payment_contract_id_idx").on(table.contractId),
    index("payment_payer_user_id_idx").on(table.payerUserId),
  ],
);

export const stripeWebhookEvent = pgTable(
  "stripe_webhook_event",
  {
    id: text("id").primaryKey(),
    stripeEventId: text("stripe_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_event_event_id_idx").on(table.stripeEventId),
  ],
);
