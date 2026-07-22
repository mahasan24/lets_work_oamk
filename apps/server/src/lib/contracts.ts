import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { contract, type contractStatusEnum } from "@lets_work/db/schema/contracts";
import { job } from "@lets_work/db/schema/jobs";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { and, desc, eq, inArray, or } from "drizzle-orm";

import { cancelContractMilestones } from "./milestone-helpers";
import { assertContractMilestonesCompletable } from "./milestones";

type ContractStatus = (typeof contractStatusEnum.enumValues)[number];

export class ContractNotFoundError extends Error {
  constructor() {
    super("Contract not found");
    this.name = "ContractNotFoundError";
  }
}

export class ContractForbiddenError extends Error {
  constructor(message = "You do not have access to this contract") {
    super(message);
    this.name = "ContractForbiddenError";
  }
}

export class ContractStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractStatusError";
  }
}

function serializeContract(
  row: typeof contract.$inferSelect,
  parties: {
    hirer: { id: string; name: string; image: string | null };
    freelancer: { id: string; name: string; image: string | null };
  },
  jobRow: { id: string; title: string; slug: string | null; currency: string } | null,
) {
  return {
    id: row.id,
    jobId: row.jobId,
    proposalId: row.proposalId,
    hirerUserId: row.hirerUserId,
    freelancerUserId: row.freelancerUserId,
    title: row.title,
    scope: row.scope,
    contractType: row.contractType,
    status: row.status,
    hourlyRate: row.hourlyRate,
    fixedAmount: row.fixedAmount,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    job: jobRow
      ? {
          id: jobRow.id,
          title: jobRow.title,
          slug: jobRow.slug,
          currency: jobRow.currency,
        }
      : null,
    hirer: parties.hirer,
    freelancer: parties.freelancer,
  };
}

export type ContractView = ReturnType<typeof serializeContract>;

async function getAccessibleContract(contractId: string, userId: string) {
  const [row] = await db
    .select({
      contract,
      job: {
        id: job.id,
        title: job.title,
        slug: job.slug,
        currency: job.currency,
      },
      hirer: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(contract)
    .leftJoin(job, eq(job.id, contract.jobId))
    .innerJoin(user, eq(user.id, contract.hirerUserId))
    .where(eq(contract.id, contractId))
    .limit(1);

  if (!row) {
    throw new ContractNotFoundError();
  }

  if (row.contract.hirerUserId !== userId && row.contract.freelancerUserId !== userId) {
    throw new ContractForbiddenError();
  }

  const [freelancer] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, row.contract.freelancerUserId))
    .limit(1);

  if (!freelancer) {
    throw new ContractNotFoundError();
  }

  const [hirerProfile] = await db
    .select({ avatarUrl: marketplaceUserProfile.avatarUrl })
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, row.contract.hirerUserId))
    .limit(1);

  const [freelancerProfile] = await db
    .select({ avatarUrl: marketplaceUserProfile.avatarUrl })
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, row.contract.freelancerUserId))
    .limit(1);

  return serializeContract(
    row.contract,
    {
      hirer: {
        ...row.hirer,
        image: hirerProfile?.avatarUrl ?? row.hirer.image,
      },
      freelancer: {
        ...freelancer,
        image: freelancerProfile?.avatarUrl ?? freelancer.image,
      },
    },
    row.job?.id ? row.job : null,
  );
}

export async function listUserContracts(
  userId: string,
  query?: { status?: ContractStatus; role?: "hirer" | "freelancer" },
) {
  const conditions = [];

  if (query?.role === "hirer") {
    conditions.push(eq(contract.hirerUserId, userId));
  } else if (query?.role === "freelancer") {
    conditions.push(eq(contract.freelancerUserId, userId));
  } else {
    conditions.push(
      or(eq(contract.hirerUserId, userId), eq(contract.freelancerUserId, userId)),
    );
  }

  if (query?.status) {
    conditions.push(eq(contract.status, query.status));
  }

  const rows = await db
    .select({
      contract,
      job: {
        id: job.id,
        title: job.title,
        slug: job.slug,
        currency: job.currency,
      },
      hirer: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(contract)
    .leftJoin(job, eq(job.id, contract.jobId))
    .innerJoin(user, eq(user.id, contract.hirerUserId))
    .where(and(...conditions))
    .orderBy(desc(contract.createdAt));

  const freelancerIds = [...new Set(rows.map((row) => row.contract.freelancerUserId))];
  const freelancers =
    freelancerIds.length === 0
      ? []
      : await db
          .select({
            id: user.id,
            name: user.name,
            image: user.image,
          })
          .from(user)
          .where(inArray(user.id, freelancerIds));

  const freelancerById = new Map(freelancers.map((item) => [item.id, item]));

  const items = rows.flatMap((row) => {
    const freelancer = freelancerById.get(row.contract.freelancerUserId);
    if (!freelancer) return [];
    return [
      serializeContract(
        row.contract,
        { hirer: row.hirer, freelancer },
        row.job?.id ? row.job : null,
      ),
    ];
  });

  return {
    items,
    meta: { total: items.length },
  };
}

export async function getUserContract(contractId: string, userId: string) {
  return getAccessibleContract(contractId, userId);
}

export async function completeUserContract(contractId: string, userId: string) {
  const existing = await getAccessibleContract(contractId, userId);

  if (existing.status !== "active") {
    throw new ContractStatusError("Only active contracts can be completed");
  }

  await assertContractMilestonesCompletable(contractId);

  const [updated] = await db
    .update(contract)
    .set({ status: "completed", endedAt: new Date() })
    .where(and(eq(contract.id, contractId), eq(contract.status, "active")))
    .returning();

  if (!updated) {
    throw new ContractStatusError("Only active contracts can be completed");
  }

  return getAccessibleContract(contractId, userId);
}

export async function cancelUserContract(contractId: string, userId: string) {
  const existing = await getAccessibleContract(contractId, userId);

  if (existing.status !== "active" && existing.status !== "draft") {
    throw new ContractStatusError("This contract cannot be cancelled");
  }

  // Only the hirer can cancel
  if (existing.hirerUserId !== userId) {
    throw new ContractForbiddenError("Only the hirer can cancel this contract");
  }

  await cancelContractMilestones(contractId);

  const [updated] = await db
    .update(contract)
    .set({ status: "cancelled", endedAt: new Date() })
    .where(eq(contract.id, contractId))
    .returning();

  if (!updated) {
    throw new Error("Failed to cancel contract");
  }

  return getAccessibleContract(contractId, userId);
}
