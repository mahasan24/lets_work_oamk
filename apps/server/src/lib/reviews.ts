import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { contract } from "@lets_work/db/schema/contracts";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { review } from "@lets_work/db/schema/reviews";
import { and, avg, count, desc, eq, sql } from "drizzle-orm";

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import { createNotification } from "./notifications";

export class ReviewNotFoundError extends NotFoundError {
  constructor() {
    super("Review not found", "REVIEW_NOT_FOUND");
  }
}

export class ReviewForbiddenError extends ForbiddenError {
  constructor(message = "You cannot leave this review") {
    super(message, "REVIEW_FORBIDDEN");
  }
}

export class ReviewConflictError extends ConflictError {
  constructor(message = "You have already reviewed this contract") {
    super(message, "REVIEW_CONFLICT");
  }
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

function serializeReview(
  row: typeof review.$inferSelect,
  reviewer?: { id: string; name: string; image: string | null } | null,
) {
  return {
    id: row.id,
    contractId: row.contractId,
    reviewerId: row.reviewerId,
    revieweeId: row.revieweeId,
    rating: row.rating,
    comment: row.comment,
    isPublic: row.isPublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewer: reviewer ? { id: reviewer.id, name: reviewer.name, image: reviewer.image } : null,
  };
}

export type ReviewView = ReturnType<typeof serializeReview>;

export async function recomputeUserReputation(userId: string) {
  const [stats] = await db
    .select({
      avgRating: avg(review.rating),
      reviewCount: count(review.id),
    })
    .from(review)
    .where(and(eq(review.revieweeId, userId), eq(review.isPublic, true)));

  const avgValue = stats?.avgRating != null ? Number(stats.avgRating) : null;
  const reviewCount = Number(stats?.reviewCount ?? 0);

  await db
    .update(marketplaceUserProfile)
    .set({
      avgRating: avgValue != null && Number.isFinite(avgValue) ? avgValue.toFixed(2) : null,
      reviewCount,
    })
    .where(eq(marketplaceUserProfile.userId, userId));

  return {
    avgRating: avgValue != null && Number.isFinite(avgValue) ? Number(avgValue.toFixed(2)) : null,
    reviewCount,
  };
}

/**
 * Lightweight trust score for directory/profile display (0–100).
 * Weighted from rating quality, review volume, and completed jobs.
 */
export function computeReputationScore(input: {
  avgRating: number | null;
  reviewCount: number;
  jobsCompleted: number;
}) {
  const ratingPart = input.avgRating != null ? (input.avgRating / 5) * 60 : 0;
  const volumePart = Math.min(input.reviewCount, 20) * 1.5; // max 30
  const jobsPart = Math.min(input.jobsCompleted, 20) * 0.5; // max 10
  return Math.round(Math.min(100, ratingPart + volumePart + jobsPart));
}

export async function incrementJobsCompleted(userId: string) {
  await db
    .update(marketplaceUserProfile)
    .set({
      jobsCompleted: sql`${marketplaceUserProfile.jobsCompleted} + 1`,
    })
    .where(eq(marketplaceUserProfile.userId, userId));
}

export type CreateReviewInput = {
  rating: number;
  comment?: string | null;
  isPublic?: boolean;
};

export async function createContractReview(
  contractId: string,
  reviewerId: string,
  input: CreateReviewInput,
) {
  const [contractRow] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!contractRow) {
    throw new NotFoundError("Contract not found", "CONTRACT_NOT_FOUND");
  }

  if (contractRow.status !== "completed") {
    throw new ReviewForbiddenError("Reviews can only be left on completed contracts");
  }

  const isHirer = contractRow.hirerUserId === reviewerId;
  const isFreelancer = contractRow.freelancerUserId === reviewerId;
  if (!isHirer && !isFreelancer) {
    throw new ReviewForbiddenError();
  }

  const revieweeId = isHirer ? contractRow.freelancerUserId : contractRow.hirerUserId;

  const rating = Math.trunc(input.rating);
  if (rating < 1 || rating > 5) {
    throw new ValidationError(["Rating must be between 1 and 5"], "Invalid rating");
  }

  const comment = input.comment?.trim() || null;
  if (comment && comment.length > 2000) {
    throw new ValidationError(["Comment is too long"], "Invalid comment");
  }

  const [existing] = await db
    .select({ id: review.id })
    .from(review)
    .where(and(eq(review.contractId, contractId), eq(review.reviewerId, reviewerId)))
    .limit(1);

  if (existing) {
    throw new ReviewConflictError();
  }

  const [created] = await db
    .insert(review)
    .values({
      id: crypto.randomUUID(),
      contractId,
      reviewerId,
      revieweeId,
      rating,
      comment,
      isPublic: input.isPublic ?? true,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create review");
  }

  await recomputeUserReputation(revieweeId);

  await notifyQuietly({
    userId: revieweeId,
    type: "review",
    title: "New review received",
    body: `You received a ${rating}-star review.`,
    actionUrl: isHirer ? `/freelancers/${revieweeId}` : `/clients/${revieweeId}`,
  });

  const [reviewer] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, reviewerId))
    .limit(1);

  return serializeReview(created, reviewer ?? null);
}

export async function listContractReviews(contractId: string, userId: string) {
  const [contractRow] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!contractRow) {
    throw new NotFoundError("Contract not found", "CONTRACT_NOT_FOUND");
  }

  if (contractRow.hirerUserId !== userId && contractRow.freelancerUserId !== userId) {
    throw new ReviewForbiddenError("You do not have access to these reviews");
  }

  const rows = await db
    .select({
      review,
      reviewerId: user.id,
      reviewerName: user.name,
      reviewerImage: user.image,
    })
    .from(review)
    .innerJoin(user, eq(user.id, review.reviewerId))
    .where(eq(review.contractId, contractId))
    .orderBy(desc(review.createdAt));

  const items = rows.map((row) =>
    serializeReview(row.review, {
      id: row.reviewerId,
      name: row.reviewerName,
      image: row.reviewerImage,
    }),
  );

  const myReview = items.find((item) => item.reviewerId === userId) ?? null;
  const counterpartReview = items.find((item) => item.reviewerId !== userId) ?? null;
  const canReview = contractRow.status === "completed" && !myReview;

  return {
    items,
    myReview,
    counterpartReview,
    canReview,
    revieweeUserId:
      contractRow.hirerUserId === userId ? contractRow.freelancerUserId : contractRow.hirerUserId,
  };
}

export async function listPublicReviewsForUser(
  revieweeId: string,
  input?: { page?: number; limit?: number },
) {
  const { page, limit, offset } = resolvePagination(input, { defaultLimit: 10, maxLimit: 50 });

  const whereClause = and(eq(review.revieweeId, revieweeId), eq(review.isPublic, true));

  const [[totalRow], rows] = await Promise.all([
    db.select({ total: count() }).from(review).where(whereClause),
    db
      .select({
        review,
        reviewerId: user.id,
        reviewerName: user.name,
        reviewerImage: user.image,
      })
      .from(review)
      .innerJoin(user, eq(user.id, review.reviewerId))
      .where(whereClause)
      .orderBy(desc(review.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const items = rows.map((row) =>
    serializeReview(row.review, {
      id: row.reviewerId,
      name: row.reviewerName,
      image: row.reviewerImage,
    }),
  );

  return {
    items,
    pagination: buildPaginationMeta(page, limit, totalRow?.total ?? 0),
  };
}
