import { db } from "@lets_work/db";
import { contract } from "@lets_work/db/schema/contracts";
import { job } from "@lets_work/db/schema/jobs";
import { milestone } from "@lets_work/db/schema/milestones";
import { and, eq, inArray } from "drizzle-orm";

type CreateDefaultMilestoneInput = {
  contractId: string;
  title: string;
  amount: string;
  currency: string;
  description?: string | null;
};

export async function createDefaultMilestone(
  input: CreateDefaultMilestoneInput,
  tx: Pick<typeof db, "insert"> = db,
) {
  const [created] = await tx
    .insert(milestone)
    .values({
      id: crypto.randomUUID(),
      contractId: input.contractId,
      title: input.title,
      description: input.description ?? null,
      amount: input.amount,
      currency: input.currency,
      sortOrder: 0,
      status: "pending",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create default milestone");
  }

  return created;
}

export async function createDefaultMilestoneForContract(
  contractRow: typeof contract.$inferSelect,
  jobRow: Pick<typeof job.$inferSelect, "title" | "currency" | "description"> | null,
  tx: Pick<typeof db, "insert"> = db,
) {
  if (contractRow.contractType !== "one_time" || !contractRow.fixedAmount) {
    return null;
  }

  return createDefaultMilestone(
    {
      contractId: contractRow.id,
      title: "Project delivery",
      amount: contractRow.fixedAmount,
      currency: jobRow?.currency ?? "USD",
      description: jobRow?.description ?? contractRow.scope,
    },
    tx,
  );
}

export async function cancelContractMilestones(contractId: string, tx: Pick<typeof db, "update"> = db) {
  await tx
    .update(milestone)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(milestone.contractId, contractId),
        inArray(milestone.status, [
          "pending",
          "funded",
          "in_progress",
          "submitted",
          "revision_requested",
          "disputed",
        ]),
      ),
    );
}

export async function getContractMilestoneProgress(contractId: string) {
  const rows = await db
    .select({ status: milestone.status })
    .from(milestone)
    .where(eq(milestone.contractId, contractId));

  const total = rows.length;
  const approved = rows.filter((row) => row.status === "approved" || row.status === "released").length;
  const active = rows.filter(
    (row) => row.status !== "cancelled" && row.status !== "approved" && row.status !== "released",
  ).length;

  return {
    total,
    approved,
    active,
    completionPercent: total === 0 ? 0 : Math.round((approved / total) * 100),
  };
}
