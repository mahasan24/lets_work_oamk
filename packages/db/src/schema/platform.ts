import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const platformRoleEnum = pgEnum("platform_role", [
  "admin",
  "moderator",
  "support",
]);

export const platformUser = pgTable(
  "platform_user",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    role: platformRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("platform_user_role_idx").on(table.role)],
);

export const platformSetting = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const feeSchedule = pgTable("fee_schedule", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientFeePercent: numeric("client_fee_percent", {
    precision: 5,
    scale: 2,
  }).notNull(),
  freelancerFeePercent: numeric("freelancer_fee_percent", {
    precision: 5,
    scale: 2,
  }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
