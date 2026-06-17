import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { job, proposal } from "./jobs";

export const aiFeatureEnum = pgEnum("ai_feature", [
  "job_description",
  "proposal_draft",
  "talent_match",
  "job_match",
  "profile_optimize",
]);

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: aiFeatureEnum("feature").notNull(),
    model: text("model"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCost: numeric("estimated_cost", { precision: 10, scale: 6 }),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_usage_log_user_id_idx").on(table.userId),
    index("ai_usage_log_feature_idx").on(table.feature),
    index("ai_usage_log_created_at_idx").on(table.createdAt),
  ],
);

export const aiRecommendation = pgTable(
  "ai_recommendation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: aiFeatureEnum("feature").notNull(),
    jobId: text("job_id").references(() => job.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id").references(() => proposal.id, {
      onDelete: "cascade",
    }),
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    score: numeric("score", { precision: 5, scale: 4 }),
    output: jsonb("output"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_recommendation_user_id_idx").on(table.userId),
    index("ai_recommendation_job_id_idx").on(table.jobId),
  ],
);
