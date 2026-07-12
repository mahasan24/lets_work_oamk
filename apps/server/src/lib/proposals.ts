import { db } from "@lets_work/db";
import {
  job,
  proposal,
  type JobAttachment,
  type JobAttachmentInput,
  type jobDurationEnum,
} from "@lets_work/db/schema/jobs";
import { and, eq, sql } from "drizzle-orm";

import { JobNotFoundError } from "./hirer";

type ProposalRow = typeof proposal.$inferSelect;
type EstimatedDuration = (typeof jobDurationEnum.enumValues)[number];

const SUBMITTABLE_JOB_STATUSES = ["open", "in_review"] as const;

export type ProposalWriteInput = {
  coverLetter?: string;
  proposedRate?: string | null;
  estimatedDuration?: EstimatedDuration | null;
  attachments?: JobAttachmentInput[];
};

export class ProposalNotFoundError extends Error {
  constructor() {
    super("Proposal not found");
    this.name = "ProposalNotFoundError";
  }
}

export class ProposalForbiddenError extends Error {
  constructor(message = "You do not have access to this proposal") {
    super(message);
    this.name = "ProposalForbiddenError";
  }
}

export class ProposalStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalStatusError";
  }
}

export class ProposalValidationError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors.join("; "));
    this.name = "ProposalValidationError";
    this.errors = errors;
  }
}

function parseAmount(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
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

export function serializeProposal(row: ProposalRow) {
  return {
    id: row.id,
    jobId: row.jobId,
    freelancerUserId: row.freelancerUserId,
    coverLetter: row.coverLetter,
    proposedRate: row.proposedRate,
    estimatedDuration: row.estimatedDuration,
    attachments: (row.attachments as JobAttachment[] | null) ?? [],
    status: row.status,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateProposalForSubmit(
  row: ProposalRow,
  jobRow: typeof job.$inferSelect,
) {
  const errors: string[] = [];

  if (!row.coverLetter || row.coverLetter.trim().length < 50) {
    errors.push("Cover letter must be at least 50 characters");
  }

  const rate = parseAmount(row.proposedRate);
  if (rate == null || rate <= 0) {
    errors.push(
      jobRow.budgetType === "hourly"
        ? "Hourly rate is required"
        : "Proposed bid amount is required",
    );
  }

  if (!row.estimatedDuration) {
    errors.push("Estimated timeline is required");
  }

  return errors;
}

async function getSubmittableJob(jobId: string) {
  const [jobRow] = await db.select().from(job).where(eq(job.id, jobId)).limit(1);

  if (!jobRow) {
    throw new JobNotFoundError();
  }

  if (!SUBMITTABLE_JOB_STATUSES.includes(jobRow.status as (typeof SUBMITTABLE_JOB_STATUSES)[number])) {
    throw new ProposalStatusError("This job is not accepting proposals");
  }

  return jobRow;
}

async function getOwnedProposal(proposalId: string, freelancerUserId: string) {
  const [row] = await db
    .select()
    .from(proposal)
    .where(eq(proposal.id, proposalId))
    .limit(1);

  if (!row) {
    throw new ProposalNotFoundError();
  }

  if (row.freelancerUserId !== freelancerUserId) {
    throw new ProposalForbiddenError();
  }

  return row;
}

export async function getFreelancerProposalForJob(jobId: string, freelancerUserId: string) {
  const [row] = await db
    .select()
    .from(proposal)
    .where(and(eq(proposal.jobId, jobId), eq(proposal.freelancerUserId, freelancerUserId)))
    .limit(1);

  return row ? serializeProposal(row) : null;
}

export async function saveFreelancerProposalDraft(
  jobId: string,
  freelancerUserId: string,
  input: ProposalWriteInput,
) {
  const jobRow = await getSubmittableJob(jobId);

  if (jobRow.hirerUserId === freelancerUserId) {
    throw new ProposalForbiddenError("You cannot submit a proposal to your own job");
  }

  const [existing] = await db
    .select()
    .from(proposal)
    .where(and(eq(proposal.jobId, jobId), eq(proposal.freelancerUserId, freelancerUserId)))
    .limit(1);

  if (existing && existing.status !== "draft" && existing.status !== "withdrawn") {
    throw new ProposalStatusError("Submitted proposals cannot be edited");
  }

  const values = {
    coverLetter: input.coverLetter?.trim() ?? existing?.coverLetter ?? "",
    proposedRate: input.proposedRate ?? existing?.proposedRate ?? null,
    estimatedDuration:
      input.estimatedDuration !== undefined
        ? input.estimatedDuration
        : (existing?.estimatedDuration ?? null),
    attachments:
      input.attachments !== undefined
        ? normalizeAttachments(input.attachments)
        : ((existing?.attachments as JobAttachment[] | null) ?? []),
  };

  if (existing) {
    const [updated] = await db
      .update(proposal)
      .set({
        ...values,
        status: "draft",
        submittedAt: null,
      })
      .where(eq(proposal.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update proposal");
    }

    return serializeProposal(updated);
  }

  const [created] = await db
    .insert(proposal)
    .values({
      id: crypto.randomUUID(),
      jobId,
      freelancerUserId,
      ...values,
      status: "draft",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create proposal");
  }

  return serializeProposal(created);
}

export async function submitFreelancerProposal(
  jobId: string,
  freelancerUserId: string,
  input?: ProposalWriteInput,
) {
  const jobRow = await getSubmittableJob(jobId);

  if (jobRow.hirerUserId === freelancerUserId) {
    throw new ProposalForbiddenError("You cannot submit a proposal to your own job");
  }

  let row: ProposalRow;

  if (input) {
    const saved = await saveFreelancerProposalDraft(jobId, freelancerUserId, input);
    const [fresh] = await db.select().from(proposal).where(eq(proposal.id, saved.id)).limit(1);
    if (!fresh) {
      throw new ProposalNotFoundError();
    }
    row = fresh;
  } else {
    const [existing] = await db
      .select()
      .from(proposal)
      .where(and(eq(proposal.jobId, jobId), eq(proposal.freelancerUserId, freelancerUserId)))
      .limit(1);

    if (!existing) {
      throw new ProposalNotFoundError();
    }

    row = existing;
  }

  if (row.status !== "draft") {
    throw new ProposalStatusError("Only draft proposals can be submitted");
  }

  const errors = validateProposalForSubmit(row, jobRow);
  if (errors.length > 0) {
    throw new ProposalValidationError(errors);
  }

  const [updated] = await db.transaction(async (tx) => {
    const [submitted] = await tx
      .update(proposal)
      .set({
        status: "submitted",
        submittedAt: new Date(),
      })
      .where(eq(proposal.id, row.id))
      .returning();

    if (!submitted) {
      throw new Error("Failed to submit proposal");
    }

    await tx
      .update(job)
      .set({ proposalsCount: sql`${job.proposalsCount} + 1` })
      .where(eq(job.id, jobId));

    return [submitted];
  });

  return serializeProposal(updated);
}

export async function withdrawFreelancerProposal(proposalId: string, freelancerUserId: string) {
  const row = await getOwnedProposal(proposalId, freelancerUserId);

  if (row.status !== "submitted" && row.status !== "shortlisted") {
    throw new ProposalStatusError("This proposal cannot be withdrawn");
  }

  const [updated] = await db.transaction(async (tx) => {
    const [withdrawn] = await tx
      .update(proposal)
      .set({ status: "withdrawn" })
      .where(eq(proposal.id, proposalId))
      .returning();

    if (!withdrawn) {
      throw new Error("Failed to withdraw proposal");
    }

    await tx
      .update(job)
      .set({ proposalsCount: sql`GREATEST(${job.proposalsCount} - 1, 0)` })
      .where(eq(job.id, row.jobId));

    return [withdrawn];
  });

  if (!updated) {
    throw new Error("Failed to withdraw proposal");
  }

  return serializeProposal(updated);
}
