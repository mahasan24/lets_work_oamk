import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { contract } from "@lets_work/db/schema/contracts";
import { dispute } from "@lets_work/db/schema/disputes";
import { job, proposal } from "@lets_work/db/schema/jobs";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { payment } from "@lets_work/db/schema/payments";
import { userVerification } from "@lets_work/db/schema/verification";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export async function getAdminOverviewAnalytics() {
  const weekAgo = startOfDaysAgo(7);
  const monthAgo = startOfDaysAgo(30);

  const [
    [usersTotal],
    [usersWeek],
    [usersMonth],
    [freelancers],
    [hirers],
    [suspended],
    [jobsTotal],
    [jobsOpen],
    [proposalsTotal],
    [contractsTotal],
    [contractsActive],
    [contractsDisputed],
    [disputesOpen],
    [verificationsPending],
    [paymentsHeld],
    [paymentsSucceeded],
    gmvRows,
    escrowRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(user),
    db.select({ total: count() }).from(user).where(gte(user.createdAt, weekAgo)),
    db.select({ total: count() }).from(user).where(gte(user.createdAt, monthAgo)),
    db
      .select({ total: count() })
      .from(marketplaceUserProfile)
      .where(inArray(marketplaceUserProfile.accountType, ["freelancer", "both"])),
    db
      .select({ total: count() })
      .from(marketplaceUserProfile)
      .where(inArray(marketplaceUserProfile.accountType, ["hirer", "both"])),
    db
      .select({ total: count() })
      .from(marketplaceUserProfile)
      .where(sql`${marketplaceUserProfile.suspendedAt} is not null`),
    db.select({ total: count() }).from(job),
    db.select({ total: count() }).from(job).where(eq(job.status, "open")),
    db.select({ total: count() }).from(proposal),
    db.select({ total: count() }).from(contract),
    db.select({ total: count() }).from(contract).where(eq(contract.status, "active")),
    db.select({ total: count() }).from(contract).where(eq(contract.status, "disputed")),
    db
      .select({ total: count() })
      .from(dispute)
      .where(inArray(dispute.status, ["open", "under_review"])),
    db
      .select({ total: count() })
      .from(userVerification)
      .where(and(eq(userVerification.type, "identity"), eq(userVerification.status, "pending"))),
    db.select({ total: count() }).from(payment).where(eq(payment.status, "held")),
    db.select({ total: count() }).from(payment).where(eq(payment.status, "succeeded")),
    db
      .select({
        amount: sql<string>`coalesce(sum(${payment.amount}), 0)`,
      })
      .from(payment)
      .where(inArray(payment.status, ["held", "succeeded"])),
    db
      .select({
        amount: sql<string>`coalesce(sum(${payment.amount}), 0)`,
      })
      .from(payment)
      .where(eq(payment.status, "held")),
  ]);

  return {
    users: {
      total: usersTotal?.total ?? 0,
      last7Days: usersWeek?.total ?? 0,
      last30Days: usersMonth?.total ?? 0,
      freelancers: freelancers?.total ?? 0,
      hirers: hirers?.total ?? 0,
      suspended: suspended?.total ?? 0,
    },
    jobs: {
      total: jobsTotal?.total ?? 0,
      open: jobsOpen?.total ?? 0,
    },
    proposals: {
      total: proposalsTotal?.total ?? 0,
    },
    contracts: {
      total: contractsTotal?.total ?? 0,
      active: contractsActive?.total ?? 0,
      disputed: contractsDisputed?.total ?? 0,
    },
    disputes: {
      open: disputesOpen?.total ?? 0,
    },
    verifications: {
      pending: verificationsPending?.total ?? 0,
    },
    payments: {
      heldCount: paymentsHeld?.total ?? 0,
      succeededCount: paymentsSucceeded?.total ?? 0,
      volumeUsd: Number(gmvRows[0]?.amount ?? 0),
      escrowHeldUsd: Number(escrowRows[0]?.amount ?? 0),
    },
    generatedAt: new Date().toISOString(),
  };
}

export type AdminOverviewAnalytics = Awaited<ReturnType<typeof getAdminOverviewAnalytics>>;
