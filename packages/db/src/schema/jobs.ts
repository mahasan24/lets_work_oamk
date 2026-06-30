import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const jobBudgetTypeEnum = pgEnum("job_budget_type", [
  "hourly",
  "one_time",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "open",
  "in_review",
  "filled",
  "closed",
  "cancelled",
  "paused",
]);

export const jobExperienceLevelEnum = pgEnum("job_experience_level", [
  "entry",
  "intermediate",
  "expert",
]);

export const jobDurationEnum = pgEnum("job_duration", [
  "less_than_month",
  "one_to_three_months",
  "three_to_six_months",
  "more_than_six_months",
]);

export type JobAttachment = {
  id: string;
  url: string;
  fileName: string;
  mimeType?: string | null;
};

export type JobAttachmentInput = {
  id?: string;
  url: string;
  fileName: string;
  mimeType?: string | null;
};

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "submitted",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const job = pgTable(
  "job",
  {
    id: text("id").primaryKey(),
    hirerUserId: text("hirer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").unique(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    requiredSkills: jsonb("required_skills"),
    budgetType: jobBudgetTypeEnum("budget_type").notNull(),
    budgetMin: numeric("budget_min", { precision: 12, scale: 2 }),
    budgetMax: numeric("budget_max", { precision: 12, scale: 2 }),
    hourlyRateMin: numeric("hourly_rate_min", { precision: 12, scale: 2 }),
    hourlyRateMax: numeric("hourly_rate_max", { precision: 12, scale: 2 }),
    remoteOnly: boolean("remote_only").default(true).notNull(),
    country: text("country"),
    currency: text("currency").default("USD").notNull(),
    experienceLevel: jobExperienceLevelEnum("experience_level"),
    estimatedDuration: jobDurationEnum("estimated_duration"),
    weeklyHours: integer("weekly_hours"),
    preferredTimezone: text("preferred_timezone"),
    tags: jsonb("tags").$type<string[]>(),
    attachments: jsonb("attachments").$type<JobAttachment[]>(),
    status: jobStatusEnum("status").default("draft").notNull(),
    proposalsCount: integer("proposals_count").default(0).notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("job_hirer_user_id_idx").on(table.hirerUserId),
    index("job_status_idx").on(table.status),
    uniqueIndex("job_slug_unique_idx").on(table.slug),
  ],
);

export const proposal = pgTable(
  "proposal",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    freelancerUserId: text("freelancer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    coverLetter: text("cover_letter").notNull(),
    proposedRate: numeric("proposed_rate", { precision: 12, scale: 2 }),
    status: proposalStatusEnum("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("proposal_job_id_idx").on(table.jobId),
    index("proposal_freelancer_user_id_idx").on(table.freelancerUserId),
    uniqueIndex("proposal_unique_idx").on(table.jobId, table.freelancerUserId),
  ],
);
