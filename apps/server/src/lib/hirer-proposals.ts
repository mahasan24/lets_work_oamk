import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import {
  job,
  proposal,
  type jobBudgetTypeEnum,
  type proposalStatusEnum,
} from "@lets_work/db/schema/jobs";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { and, asc, desc, eq, ne } from "drizzle-orm";

import { getHirerJob } from "./jobs";
import { ProposalNotFoundError, serializeProposal } from "./proposals";

type ProposalStatus = (typeof proposalStatusEnum.enumValues)[number];
type BudgetType = (typeof jobBudgetTypeEnum.enumValues)[number];

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

  const statusCounts = items.reduce(
    (counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<ProposalStatus, number>>,
  );

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
