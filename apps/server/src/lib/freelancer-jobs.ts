import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import {
  job,
  proposal,
  type jobBudgetTypeEnum,
  type jobExperienceLevelEnum,
  type jobStatusEnum,
  type proposalStatusEnum,
} from "@lets_work/db/schema/jobs";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { savedJob } from "@lets_work/db/schema/saved-jobs";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { JobNotFoundError } from "./hirer";
import { buildPaginationMeta, resolvePagination } from "./http";
import { serializePublicJob } from "./jobs";

type JobStatus = (typeof jobStatusEnum.enumValues)[number];
type BudgetType = (typeof jobBudgetTypeEnum.enumValues)[number];
type ExperienceLevel = (typeof jobExperienceLevelEnum.enumValues)[number];
type ProposalStatus = (typeof proposalStatusEnum.enumValues)[number];

const PUBLIC_JOB_STATUSES: JobStatus[] = ["open", "in_review"];

export type JobFeedTab = "best_match" | "newest" | "saved";

export type JobFeedQuery = {
  tab?: JobFeedTab;
  search?: string;
  category?: string;
  skills?: string[];
  experienceLevel?: ExperienceLevel;
  budgetType?: BudgetType;
  minBudget?: string;
  maxBudget?: string;
  postedWithin?: "24h" | "7d" | "30d";
  remoteOnly?: boolean;
  page?: number;
  limit?: number;
};

function parseAmount(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function postedWithinToDate(value: JobFeedQuery["postedWithin"]) {
  if (!value) return null;
  const hours = value === "24h" ? 24 : value === "7d" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function normalizeSkills(values: string[] | undefined | null) {
  if (!values) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Skills the freelancer listed on their profile, used to rank the "best match" feed.
 */
async function getFreelancerSkills(userId: string) {
  const [row] = await db
    .select({ skills: marketplaceUserProfile.skills })
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, userId))
    .limit(1);

  return normalizeSkills(row?.skills as string[] | null);
}

/**
 * Job skills that also appear on the freelancer's profile, matched case-insensitively.
 * Returns an empty array when the freelancer has no skills on file.
 */
function matchedSkillsSql(skills: string[]) {
  if (skills.length === 0) return sql<string[]>`'[]'::jsonb`;

  const profileSkills = sql`${JSON.stringify(skills)}::jsonb`;

  return sql<string[]>`(
    select coalesce(jsonb_agg(job_skill), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(${job.requiredSkills}, '[]'::jsonb)) as job_skill
    where exists (
      select 1
      from jsonb_array_elements_text(${profileSkills}) as profile_skill
      where lower(profile_skill) = lower(job_skill)
    )
  )`;
}

function matchCountSql(skills: string[]) {
  if (skills.length === 0) return sql<number>`0`;

  const profileSkills = sql`${JSON.stringify(skills)}::jsonb`;

  return sql<number>`(
    select count(*)::int
    from jsonb_array_elements_text(coalesce(${job.requiredSkills}, '[]'::jsonb)) as job_skill
    where exists (
      select 1
      from jsonb_array_elements_text(${profileSkills}) as profile_skill
      where lower(profile_skill) = lower(job_skill)
    )
  )`;
}

/**
 * Share of the job's required skills the freelancer covers, 0-100.
 */
function matchPercentSql(skills: string[]) {
  if (skills.length === 0) return sql<number>`0`;

  return sql<number>`(
    case
      when jsonb_array_length(coalesce(${job.requiredSkills}, '[]'::jsonb)) = 0 then 0
      else round(
        ${matchCountSql(skills)}::numeric * 100
        / jsonb_array_length(coalesce(${job.requiredSkills}, '[]'::jsonb))
      )::int
    end
  )`;
}

/**
 * Matches a job when any of the requested skills appears in its required skills.
 */
function skillFilterSql(skills: string[]) {
  const requested = sql`${JSON.stringify(skills)}::jsonb`;

  return sql`exists (
    select 1
    from jsonb_array_elements_text(coalesce(${job.requiredSkills}, '[]'::jsonb)) as job_skill
    where exists (
      select 1
      from jsonb_array_elements_text(${requested}) as wanted
      where lower(job_skill) like '%' || lower(wanted) || '%'
    )
  )`;
}

export async function listFreelancerJobFeed(userId: string, query: JobFeedQuery) {
  const tab: JobFeedTab = query.tab ?? "best_match";
  const { page, limit, offset } = resolvePagination(query, { maxLimit: 50 });

  const profileSkills = await getFreelancerSkills(userId);

  const conditions: SQL[] = [inArray(job.status, PUBLIC_JOB_STATUSES)];

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    conditions.push(or(ilike(job.title, term), ilike(job.description, term))!);
  }

  if (query.category?.trim()) {
    conditions.push(eq(job.category, query.category.trim()));
  }

  const requestedSkills = normalizeSkills(query.skills);
  if (requestedSkills.length > 0) {
    conditions.push(skillFilterSql(requestedSkills));
  }

  if (query.experienceLevel) {
    conditions.push(eq(job.experienceLevel, query.experienceLevel));
  }

  if (query.budgetType) {
    conditions.push(eq(job.budgetType, query.budgetType));
  }

  if (query.remoteOnly === true) {
    conditions.push(eq(job.remoteOnly, true));
  }

  const postedAfter = postedWithinToDate(query.postedWithin);
  if (postedAfter) {
    conditions.push(gte(job.publishedAt, postedAfter));
  }

  const minBudget = parseAmount(query.minBudget);
  if (minBudget != null) {
    conditions.push(
      or(
        and(eq(job.budgetType, "one_time"), gte(sql`${job.budgetMax}::numeric`, minBudget)),
        and(eq(job.budgetType, "hourly"), gte(sql`${job.hourlyRateMax}::numeric`, minBudget)),
      )!,
    );
  }

  const maxBudget = parseAmount(query.maxBudget);
  if (maxBudget != null) {
    conditions.push(
      or(
        and(eq(job.budgetType, "one_time"), lte(sql`${job.budgetMin}::numeric`, maxBudget)),
        and(eq(job.budgetType, "hourly"), lte(sql`${job.hourlyRateMin}::numeric`, maxBudget)),
      )!,
    );
  }

  if (tab === "saved") {
    conditions.push(sql`${savedJob.id} is not null`);
  }

  const whereClause = and(...conditions)!;
  const matchCount = matchCountSql(profileSkills);

  // Postgres treats bare integer literals in `ORDER BY` as "select-list positions".
  // When a freelancer has no skills, `matchCountSql()` returns a constant `0`,
  // which would produce `ORDER BY 0` and crash with:
  // "ORDER BY position 0 is not in select list".
  // So for empty profile skills we fall back to deterministic date ordering.
  const orderBy =
    tab === "saved"
      ? [desc(savedJob.createdAt)]
      : tab === "newest"
        ? [desc(job.publishedAt), desc(job.createdAt)]
        : profileSkills.length === 0
          ? [desc(job.publishedAt), desc(job.createdAt)]
          : [desc(matchCount), desc(job.publishedAt), desc(job.createdAt)];

  const baseQuery = db
    .select({
      job,
      hirerName: user.name,
      hirerCompany: marketplaceUserProfile.companyName,
      hirerHeadline: marketplaceUserProfile.headline,
      matchedSkills: matchedSkillsSql(profileSkills),
      matchPercent: matchPercentSql(profileSkills),
      proposalStatus: proposal.status,
      proposalId: proposal.id,
      proposalSubmittedAt: proposal.submittedAt,
      savedAt: savedJob.createdAt,
    })
    .from(job)
    .innerJoin(user, eq(user.id, job.hirerUserId))
    .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, job.hirerUserId))
    .leftJoin(proposal, and(eq(proposal.jobId, job.id), eq(proposal.freelancerUserId, userId)))
    .leftJoin(savedJob, and(eq(savedJob.jobId, job.id), eq(savedJob.freelancerUserId, userId)));

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(job)
    .leftJoin(savedJob, and(eq(savedJob.jobId, job.id), eq(savedJob.freelancerUserId, userId)));

  const [rows, countRows] = await Promise.all([
    baseQuery
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    countQuery.where(whereClause),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      ...serializePublicJob(row.job, {
        name: row.hirerName,
        companyName: row.hirerCompany,
        headline: row.hirerHeadline,
      }),
      matchedSkills: (row.matchedSkills as string[] | null) ?? [],
      matchPercent: row.matchPercent ?? 0,
      proposalStatus: row.proposalStatus ?? null,
      proposalSubmittedAt: row.proposalSubmittedAt ?? null,
      isSaved: row.savedAt != null,
    })),
    profileSkills,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function saveJobForFreelancer(userId: string, jobId: string) {
  const [target] = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.id, jobId), inArray(job.status, PUBLIC_JOB_STATUSES)))
    .limit(1);

  if (!target) {
    throw new JobNotFoundError();
  }

  await db
    .insert(savedJob)
    .values({ id: crypto.randomUUID(), freelancerUserId: userId, jobId })
    .onConflictDoNothing({ target: [savedJob.freelancerUserId, savedJob.jobId] });

  return { saved: true as const };
}

export async function unsaveJobForFreelancer(userId: string, jobId: string) {
  await db
    .delete(savedJob)
    .where(and(eq(savedJob.freelancerUserId, userId), eq(savedJob.jobId, jobId)));

  return { saved: false as const };
}

export type FreelancerProposalListQuery = {
  status?: ProposalStatus;
  page?: number;
  limit?: number;
};

export async function listFreelancerProposals(
  userId: string,
  query: FreelancerProposalListQuery = {},
) {
  const { page, limit, offset } = resolvePagination(query, { maxLimit: 50 });

  const conditions: SQL[] = [eq(proposal.freelancerUserId, userId)];
  if (query.status) {
    conditions.push(eq(proposal.status, query.status));
  }

  const whereClause = and(...conditions)!;

  const [rows, countRows, statusRows] = await Promise.all([
    db
      .select({
        proposal,
        jobTitle: job.title,
        jobSlug: job.slug,
        jobStatus: job.status,
        jobCurrency: job.currency,
        jobBudgetType: job.budgetType,
        jobProposalsCount: job.proposalsCount,
        hirerName: user.name,
        hirerCompany: marketplaceUserProfile.companyName,
        hirerUserId: job.hirerUserId,
      })
      .from(proposal)
      .innerJoin(job, eq(job.id, proposal.jobId))
      .innerJoin(user, eq(user.id, job.hirerUserId))
      .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, job.hirerUserId))
      .where(whereClause)
      .orderBy(desc(proposal.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposal)
      .where(whereClause),
    db
      .select({ status: proposal.status, count: sql<number>`count(*)::int` })
      .from(proposal)
      .where(eq(proposal.freelancerUserId, userId))
      .groupBy(proposal.status),
  ]);

  const total = countRows[0]?.count ?? 0;
  const statusCounts = statusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});

  return {
    items: rows.map((row) => ({
      id: row.proposal.id,
      jobId: row.proposal.jobId,
      jobTitle: row.jobTitle,
      jobSlug: row.jobSlug,
      jobStatus: row.jobStatus,
      jobCurrency: row.jobCurrency,
      jobBudgetType: row.jobBudgetType,
      jobProposalsCount: row.jobProposalsCount,
      hirerUserId: row.hirerUserId,
      hirerDisplayName: row.hirerCompany?.trim() || row.hirerName?.trim() || "Client",
      coverLetter: row.proposal.coverLetter,
      proposedRate: row.proposal.proposedRate,
      estimatedDuration: row.proposal.estimatedDuration,
      status: row.proposal.status,
      submittedAt: row.proposal.submittedAt,
      createdAt: row.proposal.createdAt,
      updatedAt: row.proposal.updatedAt,
    })),
    statusCounts,
    pagination: buildPaginationMeta(page, limit, total),
  };
}
