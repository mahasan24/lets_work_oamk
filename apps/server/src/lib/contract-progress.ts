import { db } from "@lets_work/db";
import { contract, type contractStatusEnum } from "@lets_work/db/schema/contracts";
import { job } from "@lets_work/db/schema/jobs";
import { milestone } from "@lets_work/db/schema/milestones";
import { and, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

type ContractStatus = (typeof contractStatusEnum.enumValues)[number];

const TRACKED_CONTRACT_STATUSES = ["active", "paused"] as const;
const OVERDUE_MILESTONE_STATUSES = [
  "pending",
  "funded",
  "in_progress",
  "submitted",
  "revision_requested",
] as const;

function buildRoleCondition(userId: string, role?: "hirer" | "freelancer") {
  if (role === "hirer") {
    return eq(contract.hirerUserId, userId);
  }
  if (role === "freelancer") {
    return eq(contract.freelancerUserId, userId);
  }
  return or(eq(contract.hirerUserId, userId), eq(contract.freelancerUserId, userId));
}

export async function getContractProgressSummary(
  userId: string,
  query?: { role?: "hirer" | "freelancer" },
) {
  const roleCondition = buildRoleCondition(userId, query?.role);

  const contractRows = await db
    .select({
      contract,
      jobTitle: job.title,
    })
    .from(contract)
    .leftJoin(job, eq(job.id, contract.jobId))
    .where(
      and(
        roleCondition,
        inArray(contract.status, [...TRACKED_CONTRACT_STATUSES, "disputed"]),
      ),
    )
    .orderBy(desc(contract.updatedAt));

  const contractIds = contractRows.map((row) => row.contract.id);
  const milestoneRows =
    contractIds.length === 0
      ? []
      : await db
          .select()
          .from(milestone)
          .where(inArray(milestone.contractId, contractIds))
          .orderBy(milestone.dueDate);

  const milestonesByContract = new Map<string, typeof milestone.$inferSelect[]>();
  for (const row of milestoneRows) {
    const current = milestonesByContract.get(row.contractId) ?? [];
    current.push(row);
    milestonesByContract.set(row.contractId, current);
  }

  const now = new Date();
  const overdueMilestones = milestoneRows
    .filter(
      (row) =>
        row.dueDate &&
        row.dueDate < now &&
        OVERDUE_MILESTONE_STATUSES.includes(
          row.status as (typeof OVERDUE_MILESTONE_STATUSES)[number],
        ),
    )
    .map((row) => {
      const contractRow = contractRows.find((item) => item.contract.id === row.contractId);
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        dueDate: row.dueDate,
        contract: {
          id: row.contractId,
          title: contractRow?.contract.title ?? "Contract",
          jobTitle: contractRow?.jobTitle ?? null,
          status: contractRow?.contract.status ?? "active",
        },
      };
    })
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

  const upcomingMilestones = milestoneRows
    .filter(
      (row) =>
        row.dueDate &&
        row.dueDate >= now &&
        OVERDUE_MILESTONE_STATUSES.includes(
          row.status as (typeof OVERDUE_MILESTONE_STATUSES)[number],
        ),
    )
    .slice(0, 5)
    .map((row) => {
      const contractRow = contractRows.find((item) => item.contract.id === row.contractId);
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        dueDate: row.dueDate,
        contract: {
          id: row.contractId,
          title: contractRow?.contract.title ?? "Contract",
        },
      };
    });

  const contracts = contractRows.map((row) => {
    const milestones = milestonesByContract.get(row.contract.id) ?? [];
    const approved = milestones.filter(
      (item) => item.status === "approved" || item.status === "released",
    ).length;

    return {
      id: row.contract.id,
      title: row.contract.title,
      status: row.contract.status,
      jobTitle: row.jobTitle,
      milestoneTotal: milestones.length,
      milestoneApproved: approved,
      completionPercent:
        milestones.length === 0 ? 0 : Math.round((approved / milestones.length) * 100),
    };
  });

  const statusCounts = contractRows.reduce<Record<ContractStatus, number>>(
    (acc, row) => {
      acc[row.contract.status] = (acc[row.contract.status] ?? 0) + 1;
      return acc;
    },
    {
      draft: 0,
      active: 0,
      paused: 0,
      completed: 0,
      cancelled: 0,
      disputed: 0,
    },
  );

  const [aggregate] =
    contractIds.length === 0
      ? [{ totalMilestones: 0, approvedMilestones: 0 }]
      : await db
          .select({
            totalMilestones: sql<number>`count(*)::int`,
            approvedMilestones: sql<number>`count(*) filter (where ${milestone.status} in ('approved', 'released'))::int`,
          })
          .from(milestone)
          .where(inArray(milestone.contractId, contractIds));

  return {
    contracts,
    overdueMilestones,
    upcomingMilestones,
    meta: {
      activeContracts: statusCounts.active,
      pausedContracts: statusCounts.paused,
      disputedContracts: statusCounts.disputed,
      overdueCount: overdueMilestones.length,
      totalMilestones: Number(aggregate?.totalMilestones ?? 0),
      approvedMilestones: Number(aggregate?.approvedMilestones ?? 0),
      overallCompletionPercent:
        Number(aggregate?.totalMilestones ?? 0) === 0
          ? 0
          : Math.round(
              (Number(aggregate?.approvedMilestones ?? 0) /
                Number(aggregate?.totalMilestones ?? 0)) *
                100,
            ),
    },
  };
}

export async function countOverdueMilestonesForUser(
  userId: string,
  role?: "hirer" | "freelancer",
) {
  const roleCondition = buildRoleCondition(userId, role);
  const now = new Date();

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(milestone)
    .innerJoin(contract, eq(contract.id, milestone.contractId))
    .where(
      and(
        roleCondition,
        inArray(contract.status, [...TRACKED_CONTRACT_STATUSES, "disputed"]),
        isNotNull(milestone.dueDate),
        lt(milestone.dueDate, now),
        inArray(milestone.status, [...OVERDUE_MILESTONE_STATUSES]),
      ),
    );

  return Number(row?.count ?? 0);
}
