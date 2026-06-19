import { index, pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const certification = pgTable(
  "certification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer"),
    issueDate: timestamp("issue_date"),
    expiryDate: timestamp("expiry_date"),
    credentialId: text("credential_id"),
    credentialUrl: text("credential_url"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("certification_user_id_idx").on(table.userId)],
);
