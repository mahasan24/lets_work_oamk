import { db } from "@lets_work/db";
import {
  job,
  type JobAttachment,
  type JobAttachmentInput,
  type jobBudgetTypeEnum,
  type jobDurationEnum,
  type jobExperienceLevelEnum,
  type jobStatusEnum,
} from "@lets_work/db/schema/jobs";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  JobForbiddenError,
  JobNotFoundError,
  JobStatusError,
  JobValidationError,
} from "./hirer";
import { SUPPORTED_CURRENCIES } from "./job-constants";

type JobRow = typeof job.$inferSelect;
type JobStatus = (typeof jobStatusEnum.enumValues)[number];
type BudgetType = (typeof jobBudgetTypeEnum.enumValues)[number];
type ExperienceLevel = (typeof jobExperienceLevelEnum.enumValues)[number];
type EstimatedDuration = (typeof jobDurationEnum.enumValues)[number];

export type JobWriteInput = {
  title?: string;
  description?: string;
  category?: string;
  requiredSkills?: string[];
  budgetType?: BudgetType;
  budgetMin?: string | null;
  budgetMax?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  remoteOnly?: boolean;
  country?: string | null;
  currency?: string;
  experienceLevel?: ExperienceLevel | null;
  estimatedDuration?: EstimatedDuration | null;
  weeklyHours?: number | null;
  preferredTimezone?: string | null;
  tags?: string[];
  attachments?: JobAttachmentInput[];
};

export type HirerJobListQuery = {
  status?: JobStatus;
  search?: string;
  page?: number;
  limit?: number;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createJobSlug(title: string) {
  const base = slugify(title).slice(0, 60) || "job";
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base}-${suffix}`;
}

function parseAmount(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeStringArray(values: string[] | undefined) {
  if (!values) return undefined;
  const normalized = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : [];
}

function normalizeAttachments(attachments: JobAttachmentInput[] | undefined) {
  if (!attachments) return undefined;
  return attachments
    .filter((item) => item.url?.trim() && item.fileName?.trim())
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      url: item.url.trim(),
      fileName: item.fileName.trim(),
      mimeType: item.mimeType?.trim() || null,
    }));
}

export function serializeJob(row: JobRow) {
  return {
    ...row,
    requiredSkills: (row.requiredSkills as string[] | null) ?? [],
    tags: (row.tags as string[] | null) ?? [],
    attachments: (row.attachments as JobAttachment[] | null) ?? [],
  };
}

export function validateJobForPublish(row: JobRow) {
  const errors: string[] = [];

  if (!row.title || row.title.trim().length < 10) {
    errors.push("Title must be at least 10 characters");
  }

  if (!row.description || row.description.trim().length < 50) {
    errors.push("Description must be at least 50 characters");
  }

  if (!row.category?.trim()) {
    errors.push("Category is required");
  }

  const skills = (row.requiredSkills as string[] | null) ?? [];
  if (skills.length === 0) {
    errors.push("At least one required skill is needed");
  }

  if (!row.currency || !SUPPORTED_CURRENCIES.includes(row.currency as (typeof SUPPORTED_CURRENCIES)[number])) {
    errors.push("A supported currency is required");
  }

  if (row.budgetType === "hourly") {
    const min = parseAmount(row.hourlyRateMin);
    const max = parseAmount(row.hourlyRateMax);
    if (min == null || max == null) {
      errors.push("Hourly rate minimum and maximum are required");
    } else if (min > max) {
      errors.push("Hourly rate minimum cannot exceed maximum");
    }
  }

  if (row.budgetType === "one_time") {
    const min = parseAmount(row.budgetMin);
    const max = parseAmount(row.budgetMax);
    if (min == null || max == null) {
      errors.push("Project budget minimum and maximum are required");
    } else if (min > max) {
      errors.push("Project budget minimum cannot exceed maximum");
    }
  }

  if (!row.remoteOnly && !row.country?.trim()) {
    errors.push("Country is required for on-site or hybrid jobs");
  }

  if (row.weeklyHours != null && (row.weeklyHours < 1 || row.weeklyHours > 168)) {
    errors.push("Weekly hours must be between 1 and 168");
  }

  return errors;
}

function buildJobUpdateValues(input: JobWriteInput) {
  const values: Partial<typeof job.$inferInsert> = {};

  if (input.title !== undefined) values.title = input.title.trim();
  if (input.description !== undefined) values.description = input.description.trim();
  if (input.category !== undefined) values.category = input.category.trim();
  if (input.requiredSkills !== undefined) {
    values.requiredSkills = normalizeStringArray(input.requiredSkills);
  }
  if (input.budgetType !== undefined) values.budgetType = input.budgetType;
  if (input.budgetMin !== undefined) values.budgetMin = input.budgetMin;
  if (input.budgetMax !== undefined) values.budgetMax = input.budgetMax;
  if (input.hourlyRateMin !== undefined) values.hourlyRateMin = input.hourlyRateMin;
  if (input.hourlyRateMax !== undefined) values.hourlyRateMax = input.hourlyRateMax;
  if (input.remoteOnly !== undefined) values.remoteOnly = input.remoteOnly;
  if (input.country !== undefined) values.country = input.country?.trim() || null;
  if (input.currency !== undefined) values.currency = input.currency;
  if (input.experienceLevel !== undefined) values.experienceLevel = input.experienceLevel;
  if (input.estimatedDuration !== undefined) values.estimatedDuration = input.estimatedDuration;
  if (input.weeklyHours !== undefined) values.weeklyHours = input.weeklyHours;
  if (input.preferredTimezone !== undefined) {
    values.preferredTimezone = input.preferredTimezone?.trim() || null;
  }
  if (input.tags !== undefined) values.tags = normalizeStringArray(input.tags);
  if (input.attachments !== undefined) values.attachments = normalizeAttachments(input.attachments);

  return values;
}

async function getOwnedJob(jobId: string, hirerUserId: string) {
  const [row] = await db.select().from(job).where(eq(job.id, jobId)).limit(1);

  if (!row) {
    throw new JobNotFoundError();
  }

  if (row.hirerUserId !== hirerUserId) {
    throw new JobForbiddenError();
  }

  return row;
}

function assertEditableStatus(status: JobStatus) {
  if (status === "closed") {
    throw new JobStatusError("Closed jobs cannot be edited");
  }
}

export async function createHirerJob(hirerUserId: string, input: JobWriteInput) {
  const title = input.title?.trim() || "Untitled job";

  const [created] = await db
    .insert(job)
    .values({
      id: crypto.randomUUID(),
      hirerUserId,
      title,
      slug: createJobSlug(title),
      description: input.description?.trim() || "",
      category: input.category?.trim() || "",
      requiredSkills: normalizeStringArray(input.requiredSkills) ?? [],
      budgetType: input.budgetType ?? "one_time",
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      hourlyRateMin: input.hourlyRateMin ?? null,
      hourlyRateMax: input.hourlyRateMax ?? null,
      remoteOnly: input.remoteOnly ?? true,
      country: input.country?.trim() || null,
      currency: input.currency ?? "USD",
      experienceLevel: input.experienceLevel ?? null,
      estimatedDuration: input.estimatedDuration ?? null,
      weeklyHours: input.weeklyHours ?? null,
      preferredTimezone: input.preferredTimezone?.trim() || null,
      tags: normalizeStringArray(input.tags) ?? [],
      attachments: normalizeAttachments(input.attachments) ?? [],
      status: "draft",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create job");
  }

  return serializeJob(created);
}

export async function listHirerJobs(hirerUserId: string, query: HirerJobListQuery) {
  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = [eq(job.hirerUserId, hirerUserId)];

  if (query.status) {
    conditions.push(eq(job.status, query.status));
  }

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    conditions.push(or(ilike(job.title, term), ilike(job.description, term))!);
  }

  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(job)
      .where(whereClause)
      .orderBy(desc(job.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(job)
      .where(whereClause),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    items: rows.map(serializeJob),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getHirerJob(jobId: string, hirerUserId: string) {
  const row = await getOwnedJob(jobId, hirerUserId);
  return serializeJob(row);
}

export async function updateHirerJob(jobId: string, hirerUserId: string, input: JobWriteInput) {
  const existing = await getOwnedJob(jobId, hirerUserId);
  assertEditableStatus(existing.status);

  const values = buildJobUpdateValues(input);

  if (input.title !== undefined && input.title.trim() !== existing.title) {
    values.slug = createJobSlug(input.title);
  }

  if (Object.keys(values).length === 0) {
    return serializeJob(existing);
  }

  const [updated] = await db.update(job).set(values).where(eq(job.id, jobId)).returning();

  if (!updated) {
    throw new Error("Failed to update job");
  }

  return serializeJob(updated);
}

export async function deleteHirerJob(jobId: string, hirerUserId: string) {
  const existing = await getOwnedJob(jobId, hirerUserId);

  if (existing.status !== "draft") {
    throw new JobStatusError("Only draft jobs can be deleted");
  }

  if (existing.proposalsCount > 0) {
    throw new JobStatusError("Jobs with proposals cannot be deleted");
  }

  await db.delete(job).where(eq(job.id, jobId));

  return { success: true };
}

export async function publishHirerJob(jobId: string, hirerUserId: string) {
  const existing = await getOwnedJob(jobId, hirerUserId);

  if (existing.status !== "draft") {
    throw new JobStatusError("Only draft jobs can be published");
  }

  const errors = validateJobForPublish(existing);
  if (errors.length > 0) {
    throw new JobValidationError(errors);
  }

  const [updated] = await db
    .update(job)
    .set({
      status: "open",
      publishedAt: new Date(),
      slug: existing.slug ?? createJobSlug(existing.title),
    })
    .where(eq(job.id, jobId))
    .returning();

  if (!updated) {
    throw new Error("Failed to publish job");
  }

  return serializeJob(updated);
}

export async function pauseHirerJob(jobId: string, hirerUserId: string) {
  const existing = await getOwnedJob(jobId, hirerUserId);

  if (existing.status !== "open") {
    throw new JobStatusError("Only open jobs can be paused");
  }

  const [updated] = await db
    .update(job)
    .set({ status: "paused" })
    .where(eq(job.id, jobId))
    .returning();

  if (!updated) {
    throw new Error("Failed to pause job");
  }

  return serializeJob(updated);
}

export async function resumeHirerJob(jobId: string, hirerUserId: string) {
  const existing = await getOwnedJob(jobId, hirerUserId);

  if (existing.status !== "paused") {
    throw new JobStatusError("Only paused jobs can be resumed");
  }

  const [updated] = await db
    .update(job)
    .set({ status: "open" })
    .where(eq(job.id, jobId))
    .returning();

  if (!updated) {
    throw new Error("Failed to resume job");
  }

  return serializeJob(updated);
}

export async function closeHirerJob(jobId: string, hirerUserId: string) {
  const existing = await getOwnedJob(jobId, hirerUserId);

  if (existing.status !== "open" && existing.status !== "paused") {
    throw new JobStatusError("Only open or paused jobs can be closed");
  }

  const [updated] = await db
    .update(job)
    .set({ status: "closed" })
    .where(eq(job.id, jobId))
    .returning();

  if (!updated) {
    throw new Error("Failed to close job");
  }

  return serializeJob(updated);
}

export async function getHirerJobPublishReadiness(jobId: string, hirerUserId: string) {
  const row = await getOwnedJob(jobId, hirerUserId);
  const errors = validateJobForPublish(row);

  return {
    ready: errors.length === 0,
    errors,
    status: row.status,
  };
}

export async function getPublicJobBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(job)
    .where(and(eq(job.slug, slug), eq(job.status, "open")))
    .limit(1);

  if (!row) {
    throw new JobNotFoundError();
  }

  return serializeJob(row);
}
