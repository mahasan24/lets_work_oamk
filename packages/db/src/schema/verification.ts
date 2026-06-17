import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const verificationTypeEnum = pgEnum("verification_type", [
  "identity",
  "email",
  "phone",
  "payment_method",
  "skill",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
  "expired",
]);

export const userVerification = pgTable(
  "user_verification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: verificationTypeEnum("type").notNull(),
    status: verificationStatusEnum("status").default("pending").notNull(),
    label: text("label"),
    metadata: text("metadata"),
    verifiedAt: timestamp("verified_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("user_verification_user_id_idx").on(table.userId),
    uniqueIndex("user_verification_unique_idx").on(table.userId, table.type),
  ],
);
