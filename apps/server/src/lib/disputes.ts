import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { contract } from "@lets_work/db/schema/contracts";
import { dispute } from "@lets_work/db/schema/disputes";
import { milestone } from "@lets_work/db/schema/milestones";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { recordContractEvent } from "./contract-events";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import { createNotification } from "./notifications";

const ACTIVE_DISPUTE_STATUSES = ["open", "under_review"] as const;

export class DisputeNotFoundError extends NotFoundError {
  constructor(message = "Dispute not found", code = "DISPUTE_NOT_FOUND") {
    super(message, code);
  }
}

export class DisputeForbiddenError extends ForbiddenError {
  constructor(message = "You do not have access to this dispute") {
    super(message, "DISPUTE_FORBIDDEN");
  }
}

export class DisputeConflictError extends ConflictError {
  constructor(message: string) {
    super(message, "DISPUTE_CONFLICT");
  }
}

function serializeDispute(row: typeof dispute.$inferSelect) {
  return {
    id: row.id,
    contractId: row.contractId,
    milestoneId: row.milestoneId,
    openedByUserId: row.openedByUserId,
    respondentUserId: row.respondentUserId,
    reason: row.reason,
    description: row.description,
    status: row.status,
    resolution: row.resolution,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

async function loadContractParty(contractId: string, userId: string) {
  const [row] = await db.select().from(contract).where(eq(contract.id, contractId)).limit(1);
  if (!row) {
    throw new DisputeNotFoundError("Contract not found", "CONTRACT_NOT_FOUND");
  }
  if (row.hirerUserId !== userId && row.freelancerUserId !== userId) {
    throw new DisputeForbiddenError("You do not have access to this contract");
  }
  return row;
}

export async function openContractDispute(
  contractId: string,
  userId: string,
  input: { reason: string; description: string; milestoneId?: string | null },
) {
  const contractRow = await loadContractParty(contractId, userId);

  if (contractRow.status !== "active" && contractRow.status !== "paused") {
    throw new DisputeConflictError("Only active or paused contracts can be disputed");
  }

  const reason = input.reason.trim();
  const description = input.description.trim();
  if (reason.length < 5) {
    throw new BadRequestError("Dispute reason must be at least 5 characters", "DISPUTE_REASON");
  }
  if (description.length < 20) {
    throw new BadRequestError(
      "Dispute description must be at least 20 characters",
      "DISPUTE_DESCRIPTION",
    );
  }

  const [existingOpen] = await db
    .select({ id: dispute.id })
    .from(dispute)
    .where(
      and(
        eq(dispute.contractId, contractId),
        inArray(dispute.status, [...ACTIVE_DISPUTE_STATUSES]),
      ),
    )
    .limit(1);

  if (existingOpen) {
    throw new DisputeConflictError("This contract already has an open dispute");
  }

  const milestoneId: string | null = input.milestoneId?.trim() || null;
  if (milestoneId) {
    const [mile] = await db
      .select({ id: milestone.id })
      .from(milestone)
      .where(and(eq(milestone.id, milestoneId), eq(milestone.contractId, contractId)))
      .limit(1);
    if (!mile) {
      throw new BadRequestError("Milestone not found on this contract", "MILESTONE_NOT_FOUND");
    }
  }

  const respondentUserId =
    contractRow.hirerUserId === userId ? contractRow.freelancerUserId : contractRow.hirerUserId;

  const disputeId = crypto.randomUUID();

  const [created] = await db
    .insert(dispute)
    .values({
      id: disputeId,
      contractId,
      milestoneId,
      openedByUserId: userId,
      respondentUserId,
      reason,
      description,
      status: "open",
    })
    .returning();

  if (!created) {
    throw new ConflictError("Failed to create dispute");
  }

  if (milestoneId) {
    await db.update(milestone).set({ status: "disputed" }).where(eq(milestone.id, milestoneId));
  }

  const [updated] = await db
    .update(contract)
    .set({ status: "disputed" })
    .where(and(eq(contract.id, contractId), inArray(contract.status, ["active", "paused"])))
    .returning();

  if (!updated) {
    throw new DisputeConflictError("Only active or paused contracts can be disputed");
  }

  await recordContractEvent({
    contractId,
    actorUserId: userId,
    eventType: "disputed",
    title: "Contract disputed",
    description: reason,
  });

  const respondentIsHirer = respondentUserId === contractRow.hirerUserId;
  await notifyQuietly({
    userId: respondentUserId,
    type: "contract",
    title: "Dispute opened on a contract",
    body: `${reason} — review the dispute details and respond via chat if needed.`,
    actionUrl: respondentIsHirer
      ? `/dashboard/hirer/disputes/${disputeId}`
      : `/dashboard/freelancer/disputes/${disputeId}`,
  });

  return serializeDispute(created);
}

export async function listDisputesForUser(
  userId: string,
  input?: {
    page?: number;
    limit?: number;
    status?: (typeof dispute.$inferSelect)["status"];
  },
) {
  const { page, limit, offset } = resolvePagination(input);
  const openedBy = alias(user, "dispute_opened_by");
  const respondent = alias(user, "dispute_respondent");

  const involvement = or(eq(dispute.openedByUserId, userId), eq(dispute.respondentUserId, userId))!;
  const conditions = [involvement];
  if (input?.status) {
    conditions.push(eq(dispute.status, input.status));
  }
  const whereClause = and(...conditions);

  const [[totalRow], rows] = await Promise.all([
    db.select({ total: count() }).from(dispute).where(whereClause),
    db
      .select({
        dispute,
        contractTitle: contract.title,
        contractStatus: contract.status,
        milestoneTitle: milestone.title,
        openedByName: openedBy.name,
        respondentName: respondent.name,
      })
      .from(dispute)
      .innerJoin(contract, eq(contract.id, dispute.contractId))
      .leftJoin(milestone, eq(milestone.id, dispute.milestoneId))
      .innerJoin(openedBy, eq(openedBy.id, dispute.openedByUserId))
      .innerJoin(respondent, eq(respondent.id, dispute.respondentUserId))
      .where(whereClause)
      .orderBy(desc(dispute.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: rows.map((row) => ({
      ...serializeDispute(row.dispute),
      contractTitle: row.contractTitle,
      contractStatus: row.contractStatus,
      milestoneTitle: row.milestoneTitle,
      openedByName: row.openedByName,
      respondentName: row.respondentName,
      direction:
        row.dispute.openedByUserId === userId ? ("opened" as const) : ("received" as const),
    })),
    pagination: buildPaginationMeta(page, limit, totalRow?.total ?? 0),
  };
}

export async function getDisputeForUser(disputeId: string, userId: string) {
  const openedBy = alias(user, "dispute_opened_by");
  const respondent = alias(user, "dispute_respondent");

  const [row] = await db
    .select({
      dispute,
      contractTitle: contract.title,
      contractStatus: contract.status,
      hirerUserId: contract.hirerUserId,
      freelancerUserId: contract.freelancerUserId,
      milestoneTitle: milestone.title,
      openedByName: openedBy.name,
      respondentName: respondent.name,
    })
    .from(dispute)
    .innerJoin(contract, eq(contract.id, dispute.contractId))
    .leftJoin(milestone, eq(milestone.id, dispute.milestoneId))
    .innerJoin(openedBy, eq(openedBy.id, dispute.openedByUserId))
    .innerJoin(respondent, eq(respondent.id, dispute.respondentUserId))
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!row) {
    throw new DisputeNotFoundError();
  }

  if (row.dispute.openedByUserId !== userId && row.dispute.respondentUserId !== userId) {
    throw new DisputeForbiddenError();
  }

  return {
    ...serializeDispute(row.dispute),
    contractTitle: row.contractTitle,
    contractStatus: row.contractStatus,
    milestoneTitle: row.milestoneTitle,
    openedByName: row.openedByName,
    respondentName: row.respondentName,
    direction: row.dispute.openedByUserId === userId ? ("opened" as const) : ("received" as const),
    contractPathRole: row.hirerUserId === userId ? ("hirer" as const) : ("freelancer" as const),
  };
}

export async function getActiveDisputeForContract(contractId: string, userId: string) {
  await loadContractParty(contractId, userId);

  const [row] = await db
    .select()
    .from(dispute)
    .where(
      and(
        eq(dispute.contractId, contractId),
        inArray(dispute.status, [...ACTIVE_DISPUTE_STATUSES]),
      ),
    )
    .orderBy(desc(dispute.createdAt))
    .limit(1);

  return row ? serializeDispute(row) : null;
}
