import { db } from "@lets_work/db";
import { contract } from "@lets_work/db/schema/contracts";
import { job } from "@lets_work/db/schema/jobs";
import {
  milestone,
  milestoneSubmission,
} from "@lets_work/db/schema/milestones";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import {
  ContractForbiddenError,
  ContractNotFoundError,
  ContractStatusError,
} from "./contracts";
import { createNotification } from "./notifications";

const EDITABLE_STATUSES = ["pending"] as const;
const DELETABLE_STATUSES = ["pending"] as const;
const STARTABLE_STATUSES = ["pending", "funded"] as const;
const SUBMITTABLE_STATUSES = ["in_progress", "revision_requested"] as const;
const APPROVABLE_STATUSES = ["submitted"] as const;
const REVISION_STATUSES = ["submitted"] as const;
const TERMINAL_STATUSES = ["approved", "released", "cancelled"] as const;

export class MilestoneNotFoundError extends Error {
  constructor() {
    super("Milestone not found");
    this.name = "MilestoneNotFoundError";
  }
}

export class MilestoneForbiddenError extends Error {
  constructor(message = "You do not have access to this milestone") {
    super(message);
    this.name = "MilestoneForbiddenError";
  }
}

export class MilestoneStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MilestoneStatusError";
  }
}

export class MilestoneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MilestoneValidationError";
  }
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

function serializeSubmission(row: typeof milestoneSubmission.$inferSelect) {
  return {
    id: row.id,
    submittedByUserId: row.submittedByUserId,
    note: row.note,
    attachmentUrl: row.attachmentUrl,
    createdAt: row.createdAt,
  };
}

function serializeMilestone(
  row: typeof milestone.$inferSelect,
  submissions: typeof milestoneSubmission.$inferSelect[] = [],
) {
  return {
    id: row.id,
    contractId: row.contractId,
    title: row.title,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    sortOrder: row.sortOrder,
    status: row.status,
    dueDate: row.dueDate,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    releasedAt: row.releasedAt,
    revisionNote: row.revisionNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submissions: submissions.map(serializeSubmission),
  };
}

export type MilestoneView = ReturnType<typeof serializeMilestone>;

async function getAccessibleContract(contractId: string, userId: string) {
  const [row] = await db.select().from(contract).where(eq(contract.id, contractId)).limit(1);

  if (!row) {
    throw new ContractNotFoundError();
  }

  if (row.hirerUserId !== userId && row.freelancerUserId !== userId) {
    throw new ContractForbiddenError();
  }

  return row;
}

async function getAccessibleMilestone(milestoneId: string, userId: string) {
  const [row] = await db
    .select({
      milestone,
      contract,
    })
    .from(milestone)
    .innerJoin(contract, eq(contract.id, milestone.contractId))
    .where(eq(milestone.id, milestoneId))
    .limit(1);

  if (!row) {
    throw new MilestoneNotFoundError();
  }

  if (row.contract.hirerUserId !== userId && row.contract.freelancerUserId !== userId) {
    throw new MilestoneForbiddenError();
  }

  return row;
}

async function loadMilestoneSubmissions(milestoneId: string) {
  return db
    .select()
    .from(milestoneSubmission)
    .where(eq(milestoneSubmission.milestoneId, milestoneId))
    .orderBy(desc(milestoneSubmission.createdAt));
}

async function getMilestoneView(milestoneId: string) {
  const [row] = await db.select().from(milestone).where(eq(milestone.id, milestoneId)).limit(1);
  if (!row) {
    throw new MilestoneNotFoundError();
  }

  const submissions = await loadMilestoneSubmissions(milestoneId);
  return serializeMilestone(row, submissions);
}

function parseAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new MilestoneValidationError("Amount must be greater than zero");
  }
  return amount;
}

async function validateMilestoneBudget(
  contractRow: typeof contract.$inferSelect,
  amount: string,
  excludeMilestoneId?: string,
) {
  if (contractRow.contractType !== "one_time" || !contractRow.fixedAmount) {
    return;
  }

  const conditions = [eq(milestone.contractId, contractRow.id), ne(milestone.status, "cancelled")];
  if (excludeMilestoneId) {
    conditions.push(ne(milestone.id, excludeMilestoneId));
  }

  const [totals] = await db
    .select({ total: sql<string>`coalesce(sum(${milestone.amount}), 0)` })
    .from(milestone)
    .where(and(...conditions));

  const nextTotal = Number(totals?.total ?? 0) + parseAmount(amount);
  const contractTotal = Number(contractRow.fixedAmount);

  if (nextTotal > contractTotal) {
    throw new MilestoneValidationError("Milestone amounts cannot exceed the contract total");
  }
}

function assertActiveContract(contractRow: typeof contract.$inferSelect) {
  if (contractRow.status !== "active") {
    throw new ContractStatusError("Milestones can only be managed on active contracts");
  }
}

function assertHirer(contractRow: typeof contract.$inferSelect, userId: string) {
  if (contractRow.hirerUserId !== userId) {
    throw new MilestoneForbiddenError("Only the hirer can perform this action");
  }
}

function assertFreelancer(contractRow: typeof contract.$inferSelect, userId: string) {
  if (contractRow.freelancerUserId !== userId) {
    throw new MilestoneForbiddenError("Only the freelancer can perform this action");
  }
}

export async function listContractMilestones(contractId: string, userId: string) {
  const contractRow = await getAccessibleContract(contractId, userId);

  const rows = await db
    .select()
    .from(milestone)
    .where(eq(milestone.contractId, contractId))
    .orderBy(asc(milestone.sortOrder), asc(milestone.createdAt));

  const milestoneIds = rows.map((row) => row.id);
  const submissions =
    milestoneIds.length === 0
      ? []
      : await db
          .select()
          .from(milestoneSubmission)
          .where(inArray(milestoneSubmission.milestoneId, milestoneIds))
          .orderBy(desc(milestoneSubmission.createdAt));

  const submissionsByMilestone = new Map<string, typeof milestoneSubmission.$inferSelect[]>();
  for (const submission of submissions) {
    const current = submissionsByMilestone.get(submission.milestoneId) ?? [];
    current.push(submission);
    submissionsByMilestone.set(submission.milestoneId, current);
  }

  const items = rows.map((row) =>
    serializeMilestone(row, submissionsByMilestone.get(row.id) ?? []),
  );

  const approved = items.filter(
    (item) => item.status === "approved" || item.status === "released",
  ).length;

  return {
    items,
    meta: {
      total: items.length,
      approved,
      completionPercent: items.length === 0 ? 0 : Math.round((approved / items.length) * 100),
      contractType: contractRow.contractType,
    },
  };
}

export type CreateMilestoneInput = {
  title: string;
  description?: string | null;
  amount: string;
  dueDate?: string | null;
  sortOrder?: number;
};

export async function createContractMilestone(
  contractId: string,
  userId: string,
  input: CreateMilestoneInput,
) {
  const contractRow = await getAccessibleContract(contractId, userId);
  assertActiveContract(contractRow);
  assertHirer(contractRow, userId);

  if (contractRow.contractType !== "one_time") {
    throw new MilestoneValidationError("Milestones are only supported for fixed-price contracts");
  }

  const title = input.title.trim();
  if (!title) {
    throw new MilestoneValidationError("Title is required");
  }

  await validateMilestoneBudget(contractRow, input.amount);

  let currency = "USD";
  if (contractRow.jobId) {
    const [jobRow] = await db
      .select({ currency: job.currency })
      .from(job)
      .where(eq(job.id, contractRow.jobId))
      .limit(1);
    currency = jobRow?.currency ?? "USD";
  }

  const [created] = await db
    .insert(milestone)
    .values({
      id: crypto.randomUUID(),
      contractId,
      title,
      description: input.description?.trim() || null,
      amount: input.amount,
      currency,
      sortOrder: input.sortOrder ?? 0,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: "pending",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create milestone");
  }

  await notifyQuietly({
    userId: contractRow.freelancerUserId,
    type: "contract",
    title: "New milestone added",
    body: `"${title}" was added to your contract.`,
    actionUrl: `/dashboard/freelancer/contracts/${contractId}`,
  });

  return getMilestoneView(created.id);
}

export type UpdateMilestoneInput = Partial<CreateMilestoneInput>;

export async function updateContractMilestone(
  milestoneId: string,
  userId: string,
  input: UpdateMilestoneInput,
) {
  const { milestone: milestoneRow, contract: contractRow } = await getAccessibleMilestone(
    milestoneId,
    userId,
  );
  assertActiveContract(contractRow);
  assertHirer(contractRow, userId);

  if (!EDITABLE_STATUSES.includes(milestoneRow.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new MilestoneStatusError("Only pending milestones can be edited");
  }

  const nextAmount = input.amount ?? milestoneRow.amount;
  if (input.amount) {
    await validateMilestoneBudget(contractRow, nextAmount, milestoneId);
  }

  const [updated] = await db
    .update(milestone)
    .set({
      title: input.title?.trim() || milestoneRow.title,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : milestoneRow.description,
      amount: nextAmount,
      sortOrder: input.sortOrder ?? milestoneRow.sortOrder,
      dueDate:
        input.dueDate !== undefined
          ? input.dueDate
            ? new Date(input.dueDate)
            : null
          : milestoneRow.dueDate,
    })
    .where(eq(milestone.id, milestoneId))
    .returning();

  if (!updated) {
    throw new MilestoneNotFoundError();
  }

  return getMilestoneView(updated.id);
}

export async function deleteContractMilestone(milestoneId: string, userId: string) {
  const { milestone: milestoneRow, contract: contractRow } = await getAccessibleMilestone(
    milestoneId,
    userId,
  );
  assertActiveContract(contractRow);
  assertHirer(contractRow, userId);

  if (!DELETABLE_STATUSES.includes(milestoneRow.status as (typeof DELETABLE_STATUSES)[number])) {
    throw new MilestoneStatusError("Only pending milestones can be deleted");
  }

  await db.delete(milestone).where(eq(milestone.id, milestoneId));
  return { success: true as const };
}

export async function startContractMilestone(milestoneId: string, userId: string) {
  const { milestone: milestoneRow, contract: contractRow } = await getAccessibleMilestone(
    milestoneId,
    userId,
  );
  assertActiveContract(contractRow);
  assertFreelancer(contractRow, userId);

  if (!STARTABLE_STATUSES.includes(milestoneRow.status as (typeof STARTABLE_STATUSES)[number])) {
    throw new MilestoneStatusError("This milestone cannot be started");
  }

  const [updated] = await db
    .update(milestone)
    .set({ status: "in_progress", revisionNote: null })
    .where(
      and(
        eq(milestone.id, milestoneId),
        inArray(milestone.status, [...STARTABLE_STATUSES]),
      ),
    )
    .returning();

  if (!updated) {
    throw new MilestoneStatusError("This milestone cannot be started");
  }

  return getMilestoneView(updated.id);
}

export type SubmitMilestoneInput = {
  note?: string | null;
  attachmentUrl?: string | null;
};

export async function submitContractMilestone(
  milestoneId: string,
  userId: string,
  input: SubmitMilestoneInput,
) {
  const { milestone: milestoneRow, contract: contractRow } = await getAccessibleMilestone(
    milestoneId,
    userId,
  );
  assertActiveContract(contractRow);
  assertFreelancer(contractRow, userId);

  if (!SUBMITTABLE_STATUSES.includes(milestoneRow.status as (typeof SUBMITTABLE_STATUSES)[number])) {
    throw new MilestoneStatusError("This milestone cannot be submitted right now");
  }

  const note = input.note?.trim() || null;
  const attachmentUrl = input.attachmentUrl?.trim() || null;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(milestone)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        revisionNote: null,
      })
      .where(
        and(
          eq(milestone.id, milestoneId),
          inArray(milestone.status, [...SUBMITTABLE_STATUSES]),
        ),
      )
      .returning();

    if (!row) {
      throw new MilestoneStatusError("This milestone cannot be submitted right now");
    }

    await tx.insert(milestoneSubmission).values({
      id: crypto.randomUUID(),
      milestoneId,
      submittedByUserId: userId,
      note,
      attachmentUrl,
    });

    return row;
  });

  await notifyQuietly({
    userId: contractRow.hirerUserId,
    type: "contract",
    title: "Milestone submitted",
    body: `"${updated.title}" is ready for your review.`,
    actionUrl: `/dashboard/hirer/contracts/${contractRow.id}`,
  });

  return getMilestoneView(updated.id);
}

export async function approveContractMilestone(milestoneId: string, userId: string) {
  const { milestone: milestoneRow, contract: contractRow } = await getAccessibleMilestone(
    milestoneId,
    userId,
  );
  assertActiveContract(contractRow);
  assertHirer(contractRow, userId);

  if (!APPROVABLE_STATUSES.includes(milestoneRow.status as (typeof APPROVABLE_STATUSES)[number])) {
    throw new MilestoneStatusError("Only submitted milestones can be approved");
  }

  const [updated] = await db
    .update(milestone)
    .set({
      status: "approved",
      approvedAt: new Date(),
      revisionNote: null,
    })
    .where(
      and(eq(milestone.id, milestoneId), inArray(milestone.status, [...APPROVABLE_STATUSES])),
    )
    .returning();

  if (!updated) {
    throw new MilestoneStatusError("Only submitted milestones can be approved");
  }

  await notifyQuietly({
    userId: contractRow.freelancerUserId,
    type: "contract",
    title: "Milestone approved",
    body: `"${updated.title}" was approved.`,
    actionUrl: `/dashboard/freelancer/contracts/${contractRow.id}`,
  });

  return getMilestoneView(updated.id);
}

export type RequestMilestoneRevisionInput = {
  note: string;
};

export async function requestContractMilestoneRevision(
  milestoneId: string,
  userId: string,
  input: RequestMilestoneRevisionInput,
) {
  const { milestone: milestoneRow, contract: contractRow } = await getAccessibleMilestone(
    milestoneId,
    userId,
  );
  assertActiveContract(contractRow);
  assertHirer(contractRow, userId);

  if (!REVISION_STATUSES.includes(milestoneRow.status as (typeof REVISION_STATUSES)[number])) {
    throw new MilestoneStatusError("Only submitted milestones can be sent back for revision");
  }

  const note = input.note.trim();
  if (!note) {
    throw new MilestoneValidationError("Revision feedback is required");
  }

  const [updated] = await db
    .update(milestone)
    .set({
      status: "revision_requested",
      revisionNote: note,
    })
    .where(
      and(eq(milestone.id, milestoneId), inArray(milestone.status, [...REVISION_STATUSES])),
    )
    .returning();

  if (!updated) {
    throw new MilestoneStatusError("Only submitted milestones can be sent back for revision");
  }

  await notifyQuietly({
    userId: contractRow.freelancerUserId,
    type: "contract",
    title: "Revision requested",
    body: `"${updated.title}" needs changes before approval.`,
    actionUrl: `/dashboard/freelancer/contracts/${contractRow.id}`,
  });

  return getMilestoneView(updated.id);
}

export async function assertContractMilestonesCompletable(contractId: string) {
  const rows = await db
    .select({ status: milestone.status })
    .from(milestone)
    .where(eq(milestone.contractId, contractId));

  if (rows.length === 0) {
    return;
  }

  const incomplete = rows.some(
    (row) => !TERMINAL_STATUSES.includes(row.status as (typeof TERMINAL_STATUSES)[number]),
  );

  if (incomplete) {
    throw new ContractStatusError("All milestones must be approved before completing the contract");
  }
}
