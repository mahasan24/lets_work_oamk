import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const marketplaceRoleEnum = pgEnum("marketplace_role", [
  "freelancer",
  "hirer",
  "both",
]);

export const activeMarketplaceRoleEnum = pgEnum("active_marketplace_role", [
  "freelancer",
  "hirer",
]);

export const onboardingStepEnum = pgEnum("onboarding_step", [
  "profile",
  "role_selection",
  "verification",
  "complete",
]);

export const marketplaceUserProfile = pgTable("marketplace_user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  accountType: marketplaceRoleEnum("account_type")
    .default("freelancer")
    .notNull(),
  activeRole: activeMarketplaceRoleEnum("active_role")
    .default("freelancer")
    .notNull(),
  onboardingStep: onboardingStepEnum("onboarding_step")
    .default("profile")
    .notNull(),
  profileCompletion: integer("profile_completion").default(0).notNull(),
  headline: text("headline"),
  bio: text("bio"),
  skills: jsonb("skills"),
  jobCategories: jsonb("job_categories"),
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }),
  currency: text("currency").default("USD").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
