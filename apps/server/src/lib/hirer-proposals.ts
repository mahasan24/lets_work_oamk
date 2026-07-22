import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { conversation, conversationParticipant, message } from "@lets_work/db/schema/chat";
import { contract } from "@lets_work/db/schema/contracts";
import {
  job,
  proposal,
  type jobBudgetTypeEnum,
  type proposalStatusEnum,
} from "@lets_work/db/schema/jobs";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { JobStatusError } from "./hirer";
import { getHirerJob, serializeJob } from "./jobs";
import { createDefaultMilestoneForContract } from "./milestone-helpers";
import { createNotification, createNotifications } from "./notifications";
import {
  ProposalNotFoundError,
  ProposalStatusError,
  serializeProposal,
} from "./proposals";

type ProposalStatus = (typeof proposalStatusEnum.enumValues)[number];
type BudgetType = (typeof jobBudgetTypeEnum.enumValues)[number];

const SHORTLISTABLE_STATUSES = ["submitted"] as const;
const UNSHORTLISTABLE_STATUSES = ["shortlisted"] as const;
const REJECTABLE_STATUSES = ["submitted", "shortlisted"] as const;
const HIRABLE_STATUSES = ["submitted", "shortlisted"] as const;
const HIRABLE_JOB_STATUSES = ["open", "in_review", "paused"] as const;
const ACTIVE_PROPOSAL_STATUSES = ["submitted", "shortlisted"] as const;

async function notifyQuietly(
  input: Parameters<typeof createNotification>[0] | Parameters<typeof createNotifications>[0],
) {
  try {
    if (Array.isArray(input)) {
      await createNotifications(input);
      return;
    }
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}
export type HirerProposalListQuery = {
  status?: ProposalStatus;
  sort?: "newest" | "rate_low" | "rate_high";
};

function serializeHirerProposal(
  proposalRow: typeof proposal.$inferSelect,
  freelancer: { id: string; name: string; image: string | null },
  profile: typeof marketplaceUserProfile.$inferSelect | null,
  jobRow: {
    id: string;
    title: string;
    budgetType: BudgetType;
    currency: string;
  },
) {
  const base = serializeProposal(proposalRow);
  const skills = Array.isArray(profile?.skills) ? (profile.skills as string[]) : [];

  return {
    ...base,
    job: {
      id: jobRow.id,
      title: jobRow.title,
      budgetType: jobRow.budgetType as BudgetType,
      currency: jobRow.currency,
    },
    freelancer: {
      id: freelancer.id,
      name: freelancer.name,
      image: profile?.avatarUrl ?? freelancer.image,
      headline: profile?.headline ?? null,
      country: profile?.country ?? null,
      city: profile?.city ?? null,
      skills,
      profileCompletion: profile?.profileCompletion ?? 0,
      hourlyRate: profile?.hourlyRate ?? null,
      avgRating: profile?.avgRating ?? null,
      reviewCount: profile?.reviewCount ?? 0,
      jobsCompleted: profile?.jobsCompleted ?? 0,
    },
  };
}

export type HirerProposalView = ReturnType<typeof serializeHirerProposal>;

async function getHirerOwnedProposal(proposalId: string, hirerUserId: string) {
  const [row] = await db
    .select({
      proposal,
      job,
      freelancer: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
      profile: marketplaceUserProfile,
    })
    .from(proposal)
    .innerJoin(job, eq(job.id, proposal.jobId))
    .innerJoin(user, eq(user.id, proposal.freelancerUserId))
    .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, proposal.freelancerUserId))
    .where(and(eq(proposal.id, proposalId), eq(job.hirerUserId, hirerUserId)))
    .limit(1);

  if (!row) {
    throw new ProposalNotFoundError();
  }

  return row;
}

export async function listHirerJobProposals(
  jobId: string,
  hirerUserId: string,
  query: HirerProposalListQuery,
) {
  const jobRow = await getHirerJob(jobId, hirerUserId);

  const conditions = [eq(proposal.jobId, jobId), ne(proposal.status, "draft")];

  if (query.status) {
    conditions.push(eq(proposal.status, query.status));
  }

  const orderBy =
    query.sort === "rate_low"
      ? asc(proposal.proposedRate)
      : query.sort === "rate_high"
        ? desc(proposal.proposedRate)
        : desc(proposal.submittedAt);

  const rows = await db
    .select({
      proposal,
      freelancer: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
      profile: marketplaceUserProfile,
    })
    .from(proposal)
    .innerJoin(user, eq(user.id, proposal.freelancerUserId))
    .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, proposal.freelancerUserId))
    .where(and(...conditions))
    .orderBy(orderBy);

  const items = rows.map((row) =>
    serializeHirerProposal(row.proposal, row.freelancer, row.profile, jobRow),
  );

  const statusCounts = await recountStatusCounts(jobId);

  return {
    job: {
      id: jobRow.id,
      title: jobRow.title,
      status: jobRow.status,
      proposalsCount: jobRow.proposalsCount,
      budgetType: jobRow.budgetType,
      currency: jobRow.currency,
    },
    items,
    meta: {
      total: items.length,
      statusCounts,
    },
  };
}

export async function getHirerProposal(proposalId: string, hirerUserId: string) {
  const row = await getHirerOwnedProposal(proposalId, hirerUserId);

  if (row.proposal.status === "draft") {
    throw new ProposalNotFoundError();
  }

  return serializeHirerProposal(row.proposal, row.freelancer, row.profile, row.job);
}

async function recountStatusCounts(jobId: string) {
  const rows = await db
    .select({
      status: proposal.status,
      count: sql<number>`count(*)::int`,
    })
    .from(proposal)
    .where(and(eq(proposal.jobId, jobId), ne(proposal.status, "draft")))
    .groupBy(proposal.status);

  return rows.reduce(
    (counts, row) => {
      counts[row.status] = Number(row.count);
      return counts;
    },
    {} as Partial<Record<ProposalStatus, number>>,
  );
}

export async function shortlistHirerProposal(proposalId: string, hirerUserId: string) {
  const row = await getHirerOwnedProposal(proposalId, hirerUserId);

  if (row.proposal.status === "draft") {
    throw new ProposalNotFoundError();
  }

  if (
    !SHORTLISTABLE_STATUSES.includes(
      row.proposal.status as (typeof SHORTLISTABLE_STATUSES)[number],
    )
  ) {
    throw new ProposalStatusError("Only submitted proposals can be shortlisted");
  }

  const [updated] = await db
    .update(proposal)
    .set({ status: "shortlisted" })
    .where(
      and(eq(proposal.id, proposalId), inArray(proposal.status, [...SHORTLISTABLE_STATUSES])),
    )
    .returning();

  if (!updated) {
    throw new ProposalStatusError("Only submitted proposals can be shortlisted");
  }

  await notifyQuietly({
    userId: row.proposal.freelancerUserId,
    type: "proposal",
    title: "You've been shortlisted",
    body: `Your proposal for "${row.job.title}" was shortlisted.`,
    actionUrl: `/dashboard/freelancer/jobs/${row.job.slug ?? row.job.id}`,
  });

  return serializeHirerProposal(updated, row.freelancer, row.profile, row.job);
}

export async function unshortlistHirerProposal(proposalId: string, hirerUserId: string) {
  const row = await getHirerOwnedProposal(proposalId, hirerUserId);

  if (row.proposal.status === "draft") {
    throw new ProposalNotFoundError();
  }

  if (
    !UNSHORTLISTABLE_STATUSES.includes(
      row.proposal.status as (typeof UNSHORTLISTABLE_STATUSES)[number],
    )
  ) {
    throw new ProposalStatusError("Only shortlisted proposals can be moved back to submitted");
  }

  const [updated] = await db
    .update(proposal)
    .set({ status: "submitted" })
    .where(
      and(eq(proposal.id, proposalId), inArray(proposal.status, [...UNSHORTLISTABLE_STATUSES])),
    )
    .returning();

  if (!updated) {
    throw new ProposalStatusError("Only shortlisted proposals can be moved back to submitted");
  }

  return serializeHirerProposal(updated, row.freelancer, row.profile, row.job);
}

export async function rejectHirerProposal(proposalId: string, hirerUserId: string) {
  const row = await getHirerOwnedProposal(proposalId, hirerUserId);

  if (row.proposal.status === "draft") {
    throw new ProposalNotFoundError();
  }

  if (
    !REJECTABLE_STATUSES.includes(row.proposal.status as (typeof REJECTABLE_STATUSES)[number])
  ) {
    throw new ProposalStatusError("This proposal cannot be archived");
  }

  const [updated] = await db
    .update(proposal)
    .set({ status: "rejected" })
    .where(and(eq(proposal.id, proposalId), inArray(proposal.status, [...REJECTABLE_STATUSES])))
    .returning();

  if (!updated) {
    throw new ProposalStatusError("This proposal cannot be archived");
  }

  await notifyQuietly({
    userId: row.proposal.freelancerUserId,
    type: "proposal",
    title: "Proposal update",
    body: `Your proposal for "${row.job.title}" was not selected.`,
    actionUrl: `/dashboard/freelancer/jobs/${row.job.slug ?? row.job.id}`,
  });

  return serializeHirerProposal(updated, row.freelancer, row.profile, row.job);
}

export async function messageShortlistedFreelancer(
  proposalId: string,
  hirerUserId: string,
  body: string,
) {
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    throw new ProposalStatusError("Message cannot be empty");
  }
  if (trimmed.length > 5000) {
    throw new ProposalStatusError("Message is too long");
  }

  const row = await getHirerOwnedProposal(proposalId, hirerUserId);

  if (row.proposal.status !== "shortlisted" && row.proposal.status !== "accepted") {
    throw new ProposalStatusError("You can only message shortlisted or hired freelancers");
  }

  const result = await db.transaction(async (tx) => {
    const hirerConversations = await tx
      .select({
        conversationId: conversation.id,
      })
      .from(conversation)
      .innerJoin(
        conversationParticipant,
        eq(conversationParticipant.conversationId, conversation.id),
      )
      .where(
        and(eq(conversation.jobId, row.job.id), eq(conversationParticipant.userId, hirerUserId)),
      );

    let conversationId: string | null = null;

    for (const candidate of hirerConversations) {
      const [freelancerParticipant] = await tx
        .select({ userId: conversationParticipant.userId })
        .from(conversationParticipant)
        .where(
          and(
            eq(conversationParticipant.conversationId, candidate.conversationId),
            eq(conversationParticipant.userId, row.proposal.freelancerUserId),
          ),
        )
        .limit(1);

      if (freelancerParticipant) {
        conversationId = candidate.conversationId;
        break;
      }
    }

    if (!conversationId) {
      conversationId = crypto.randomUUID();
      await tx.insert(conversation).values({
        id: conversationId,
        jobId: row.job.id,
      });
      await tx.insert(conversationParticipant).values([
        { conversationId, userId: hirerUserId },
        { conversationId, userId: row.proposal.freelancerUserId },
      ]);
    }

    const [createdMessage] = await tx
      .insert(message)
      .values({
        id: crypto.randomUUID(),
        conversationId,
        senderId: hirerUserId,
        body: trimmed,
      })
      .returning();

    if (!createdMessage) {
      throw new Error("Failed to send message");
    }

    return {
      conversationId,
      message: createdMessage,
    };
  });

  await notifyQuietly({
    userId: row.proposal.freelancerUserId,
    type: "message",
    title: `New message about "${row.job.title}"`,
    body: trimmed.slice(0, 140),
    actionUrl: `/dashboard/freelancer`,
  });

  return {
    conversationId: result.conversationId,
    message: {
      id: result.message.id,
      body: result.message.body,
      createdAt: result.message.createdAt,
    },
    proposal: serializeHirerProposal(row.proposal, row.freelancer, row.profile, row.job),
  };
}

export async function acceptHirerProposal(proposalId: string, hirerUserId: string) {
  const row = await getHirerOwnedProposal(proposalId, hirerUserId);

  if (row.proposal.status === "draft") {
    throw new ProposalNotFoundError();
  }

  if (!HIRABLE_STATUSES.includes(row.proposal.status as (typeof HIRABLE_STATUSES)[number])) {
    throw new ProposalStatusError("Only submitted or shortlisted proposals can be hired");
  }

  if (
    !HIRABLE_JOB_STATUSES.includes(row.job.status as (typeof HIRABLE_JOB_STATUSES)[number])
  ) {
    throw new JobStatusError("This job is not open for hiring");
  }

  if (!row.proposal.proposedRate) {
    throw new ProposalStatusError("Proposal is missing a proposed rate");
  }

  const hired = await db.transaction(async (tx) => {
    const [accepted] = await tx
      .update(proposal)
      .set({ status: "accepted" })
      .where(
        and(eq(proposal.id, proposalId), inArray(proposal.status, [...HIRABLE_STATUSES])),
      )
      .returning();

    if (!accepted) {
      throw new ProposalStatusError("Only submitted or shortlisted proposals can be hired");
    }

    const rejectedSiblings = await tx
      .update(proposal)
      .set({ status: "rejected" })
      .where(
        and(
          eq(proposal.jobId, row.job.id),
          ne(proposal.id, proposalId),
          inArray(proposal.status, [...ACTIVE_PROPOSAL_STATUSES]),
        ),
      )
      .returning({ freelancerUserId: proposal.freelancerUserId });

    const [filledJob] = await tx
      .update(job)
      .set({ status: "filled" })
      .where(and(eq(job.id, row.job.id), inArray(job.status, [...HIRABLE_JOB_STATUSES])))
      .returning();

    if (!filledJob) {
      throw new JobStatusError("This job is not open for hiring");
    }

    const contractType = filledJob.budgetType === "hourly" ? "hourly" : "one_time";
    const scope = filledJob.description?.trim() || accepted.coverLetter;
    const [createdContract] = await tx
      .insert(contract)
      .values({
        id: crypto.randomUUID(),
        jobId: filledJob.id,
        proposalId: accepted.id,
        hirerUserId,
        freelancerUserId: accepted.freelancerUserId,
        title: filledJob.title,
        scope,
        contractType,
        status: "active",
        hourlyRate: contractType === "hourly" ? accepted.proposedRate : null,
        fixedAmount: contractType === "one_time" ? accepted.proposedRate : null,
        startedAt: new Date(),
      })
      .returning();

    if (!createdContract) {
      throw new Error("Failed to create contract");
    }

    await createDefaultMilestoneForContract(createdContract, filledJob, tx);

    return {
      proposal: accepted,
      job: filledJob,
      contract: createdContract,
      rejectedSiblingUserIds: rejectedSiblings.map((item) => item.freelancerUserId),
    };
  });

  await notifyQuietly([
    {
      userId: row.proposal.freelancerUserId,
      type: "contract",
      title: "You've been hired",
      body: `Your proposal for "${row.job.title}" was accepted and a contract is now active.`,
      actionUrl: `/dashboard/freelancer/contracts/${hired.contract.id}`,
    },
    {
      userId: hirerUserId,
      type: "contract",
      title: "Contract started",
      body: `You hired ${row.freelancer.name} for "${row.job.title}".`,
      actionUrl: `/dashboard/hirer/contracts/${hired.contract.id}`,
    },
    ...hired.rejectedSiblingUserIds.map((userId) => ({
      userId,
      type: "proposal" as const,
      title: "Proposal update",
      body: `Another freelancer was hired for "${row.job.title}".`,
      actionUrl: `/dashboard/freelancer/jobs/${row.job.slug ?? row.job.id}`,
    })),
  ]);

  return {
    proposal: serializeHirerProposal(hired.proposal, row.freelancer, row.profile, hired.job),
    job: serializeJob(hired.job),
    contract: {
      id: hired.contract.id,
      title: hired.contract.title,
      status: hired.contract.status,
      contractType: hired.contract.contractType,
      hourlyRate: hired.contract.hourlyRate,
      fixedAmount: hired.contract.fixedAmount,
      startedAt: hired.contract.startedAt,
      createdAt: hired.contract.createdAt,
    },
    meta: {
      statusCounts: await recountStatusCounts(row.job.id),
    },
  };
}
