import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { certification } from "@lets_work/db/schema/certifications";
import { job } from "@lets_work/db/schema/jobs";
import {
  type availabilityStatusEnum,
  marketplaceUserProfile,
} from "@lets_work/db/schema/marketplace";
import { platformUser } from "@lets_work/db/schema/platform";
import { portfolioItem, workHistory } from "@lets_work/db/schema/portfolio";
import { userVerification } from "@lets_work/db/schema/verification";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { NotFoundError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import { computeReputationScore } from "./reviews";

type ProfileRow = typeof marketplaceUserProfile.$inferSelect;
type UserRow = typeof user.$inferSelect;
type AvailabilityStatus = (typeof availabilityStatusEnum.enumValues)[number];

export class PublicProfileNotFoundError extends NotFoundError {
  constructor(message = "Profile not found") {
    super(message, "PROFILE_NOT_FOUND");
  }
}

export type FreelancerSort = "recommended" | "rating" | "rate_low" | "rate_high" | "newest";

export type FreelancerSearchQuery = {
  search?: string;
  skills?: string[];
  country?: string;
  availability?: AvailabilityStatus;
  minRate?: string;
  maxRate?: string;
  minRating?: string;
  sort?: FreelancerSort;
  page?: number;
  limit?: number;
};

const FREELANCER_ACCOUNT_TYPES = ["freelancer", "both"] as const;
const HIRER_ACCOUNT_TYPES = ["hirer", "both"] as const;
const PUBLIC_JOB_STATUSES = ["open", "in_review"] as const;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseNumeric(value: string | undefined) {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `skills` is a jsonb string array, so matching has to unnest it. Using ILIKE on
 * each element keeps the filter case-insensitive and tolerant of partial terms
 * ("react" matches "React Native").
 */
function skillMatchCondition(skill: string): SQL {
  return sql`exists (
    select 1
    from jsonb_array_elements_text(coalesce(${marketplaceUserProfile.skills}, '[]'::jsonb)) as skill
    where skill ilike ${`%${skill}%`}
  )`;
}

function freelancerOrderBy(sort: FreelancerSort | undefined): SQL[] {
  switch (sort) {
    case "rating":
      return [
        desc(sql`coalesce(${marketplaceUserProfile.avgRating}, 0)`),
        desc(marketplaceUserProfile.reviewCount),
      ];
    case "rate_low":
      return [sql`${marketplaceUserProfile.hourlyRate} asc nulls last`];
    case "rate_high":
      return [sql`${marketplaceUserProfile.hourlyRate} desc nulls last`];
    case "newest":
      return [desc(marketplaceUserProfile.createdAt)];
    default:
      return [
        desc(sql`coalesce(${marketplaceUserProfile.avgRating}, 0)`),
        desc(marketplaceUserProfile.profileCompletion),
        desc(marketplaceUserProfile.jobsCompleted),
      ];
  }
}

function serializeFreelancerCard(profile: ProfileRow, owner: Pick<UserRow, "name" | "image">) {
  const avgRating = profile.avgRating != null ? Number(profile.avgRating) : null;
  return {
    userId: profile.userId,
    name: owner.name,
    avatarUrl: profile.avatarUrl ?? owner.image,
    headline: profile.headline,
    bio: profile.bio,
    skills: toStringArray(profile.skills),
    hourlyRate: profile.hourlyRate,
    currency: profile.currency,
    country: profile.country,
    city: profile.city,
    availabilityStatus: profile.availabilityStatus,
    hoursPerWeek: profile.hoursPerWeek,
    avgRating: profile.avgRating,
    reviewCount: profile.reviewCount,
    jobsCompleted: profile.jobsCompleted,
    reputationScore: computeReputationScore({
      avgRating: avgRating != null && Number.isFinite(avgRating) ? avgRating : null,
      reviewCount: profile.reviewCount,
      jobsCompleted: profile.jobsCompleted,
    }),
  };
}

/**
 * Freelancers become discoverable once they have chosen a marketplace role
 * (left role_selection). Suspended accounts are hidden.
 */
export async function searchFreelancers(query: FreelancerSearchQuery) {
  const { page, limit, offset } = resolvePagination(query, { maxLimit: 100 });

  const conditions: SQL[] = [
    inArray(marketplaceUserProfile.accountType, [...FREELANCER_ACCOUNT_TYPES]),
    sql`${marketplaceUserProfile.onboardingStep} <> 'role_selection'`,
    isNull(marketplaceUserProfile.suspendedAt),
    // Hide platform admins from the talent marketplace.
    isNull(platformUser.userId),
  ];

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    conditions.push(
      or(
        ilike(user.name, term),
        ilike(marketplaceUserProfile.headline, term),
        ilike(marketplaceUserProfile.bio, term),
        skillMatchCondition(query.search.trim()),
      )!,
    );
  }

  for (const skill of query.skills ?? []) {
    const trimmed = skill.trim();
    if (trimmed) conditions.push(skillMatchCondition(trimmed));
  }

  if (query.country?.trim()) {
    conditions.push(eq(marketplaceUserProfile.country, query.country.trim()));
  }

  if (query.availability) {
    conditions.push(eq(marketplaceUserProfile.availabilityStatus, query.availability));
  }

  const minRate = parseNumeric(query.minRate);
  if (minRate != null) {
    conditions.push(gte(marketplaceUserProfile.hourlyRate, minRate.toString()));
  }

  const maxRate = parseNumeric(query.maxRate);
  if (maxRate != null) {
    conditions.push(lte(marketplaceUserProfile.hourlyRate, maxRate.toString()));
  }

  const minRating = parseNumeric(query.minRating);
  if (minRating != null) {
    conditions.push(gte(marketplaceUserProfile.avgRating, minRating.toString()));
  }

  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({ profile: marketplaceUserProfile, name: user.name, image: user.image })
      .from(marketplaceUserProfile)
      .innerJoin(user, eq(user.id, marketplaceUserProfile.userId))
      .leftJoin(platformUser, eq(platformUser.userId, marketplaceUserProfile.userId))
      .where(whereClause)
      .orderBy(...freelancerOrderBy(query.sort))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceUserProfile)
      .innerJoin(user, eq(user.id, marketplaceUserProfile.userId))
      .leftJoin(platformUser, eq(platformUser.userId, marketplaceUserProfile.userId))
      .where(whereClause),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    items: rows.map((row) =>
      serializeFreelancerCard(row.profile, { name: row.name, image: row.image }),
    ),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

async function getPublicProfileRow(
  userId: string,
  accountTypes: readonly ProfileRow["accountType"][],
) {
  const [row] = await db
    .select({ profile: marketplaceUserProfile, name: user.name, image: user.image })
    .from(marketplaceUserProfile)
    .innerJoin(user, eq(user.id, marketplaceUserProfile.userId))
    .where(
      and(
        eq(marketplaceUserProfile.userId, userId),
        inArray(marketplaceUserProfile.accountType, [...accountTypes]),
      ),
    )
    .limit(1);

  if (!row) throw new PublicProfileNotFoundError();

  return row;
}

async function isIdentityVerified(userId: string) {
  const [row] = await db
    .select({ id: userVerification.id })
    .from(userVerification)
    .where(
      and(
        eq(userVerification.userId, userId),
        eq(userVerification.type, "identity"),
        eq(userVerification.status, "verified"),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function getPublicFreelancerProfile(userId: string) {
  const row = await getPublicProfileRow(userId, FREELANCER_ACCOUNT_TYPES);
  const { profile } = row;

  const [portfolio, certifications, experience, identityVerified] = await Promise.all([
    db
      .select()
      .from(portfolioItem)
      .where(eq(portfolioItem.userId, userId))
      .orderBy(asc(portfolioItem.sortOrder), asc(portfolioItem.createdAt)),
    db
      .select()
      .from(certification)
      .where(eq(certification.userId, userId))
      .orderBy(asc(certification.sortOrder), asc(certification.createdAt)),
    db
      .select()
      .from(workHistory)
      .where(eq(workHistory.userId, userId))
      .orderBy(asc(workHistory.sortOrder), asc(workHistory.createdAt)),
    isIdentityVerified(userId),
  ]);

  return {
    ...serializeFreelancerCard(profile, { name: row.name, image: row.image }),
    timezone: profile.timezone,
    videoIntroUrl: profile.videoIntroUrl,
    memberSince: profile.createdAt.toISOString(),
    identityVerified,
    portfolio: portfolio.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      projectUrl: item.projectUrl,
      imageUrl: item.imageUrl,
    })),
    certifications: certifications.map((item) => ({
      id: item.id,
      name: item.name,
      issuer: item.issuer,
      credentialUrl: item.credentialUrl,
      imageUrl: item.imageUrl,
      issueDate: item.issueDate?.toISOString() ?? null,
      expiryDate: item.expiryDate?.toISOString() ?? null,
    })),
    experience: experience.map((item) => ({
      id: item.id,
      title: item.title,
      company: item.company,
      description: item.description,
      startDate: item.startDate?.toISOString() ?? null,
      endDate: item.endDate?.toISOString() ?? null,
      isCurrent: item.isCurrent,
    })),
  };
}

export async function getPublicClientProfile(userId: string) {
  const row = await getPublicProfileRow(userId, HIRER_ACCOUNT_TYPES);
  const { profile } = row;

  const [openJobRows, identityVerified] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(job)
      .where(and(eq(job.hirerUserId, userId), inArray(job.status, [...PUBLIC_JOB_STATUSES]))),
    isIdentityVerified(userId),
  ]);

  return {
    userId: profile.userId,
    name: row.name,
    avatarUrl: profile.avatarUrl ?? row.image,
    headline: profile.headline,
    bio: profile.bio,
    hirerType: profile.hirerType,
    companyName: profile.companyName,
    companyWebsite: profile.companyWebsite,
    companyDescription: profile.companyDescription,
    companySize: profile.companySize,
    jobCategories: toStringArray(profile.jobCategories),
    country: profile.country,
    city: profile.city,
    timezone: profile.timezone,
    memberSince: profile.createdAt.toISOString(),
    identityVerified,
    openJobsCount: openJobRows[0]?.count ?? 0,
  };
}
