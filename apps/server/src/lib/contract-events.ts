import { db } from "@lets_work/db";
import {
  contractEvent,
  type contractEventTypeEnum,
} from "@lets_work/db/schema/contract-events";
import { contract } from "@lets_work/db/schema/contracts";
import { desc, eq } from "drizzle-orm";

import { ContractForbiddenError, ContractNotFoundError } from "./contracts";

type ContractEventType = (typeof contractEventTypeEnum.enumValues)[number];

export type RecordContractEventInput = {
  contractId: string;
  actorUserId?: string | null;
  eventType: ContractEventType;
  title: string;
  description?: string | null;
  milestoneId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type DbExecutor = Pick<typeof db, "insert">;

export async function recordContractEvent(
  input: RecordContractEventInput,
  executor: DbExecutor = db,
) {
  const [created] = await executor
    .insert(contractEvent)
    .values({
      id: crypto.randomUUID(),
      contractId: input.contractId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      title: input.title,
      description: input.description ?? null,
      milestoneId: input.milestoneId ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to record contract event");
  }

  return created;
}

export async function recordContractEvents(
  inputs: RecordContractEventInput[],
  executor: DbExecutor = db,
): Promise<void> {
  if (inputs.length === 0) return;

  await executor.insert(contractEvent).values(
    inputs.map((input) => ({
      id: crypto.randomUUID(),
      contractId: input.contractId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      title: input.title,
      description: input.description ?? null,
      milestoneId: input.milestoneId ?? null,
      metadata: input.metadata ?? null,
    })),
  );
}

function serializeContractEvent(row: typeof contractEvent.$inferSelect) {
  return {
    id: row.id,
    contractId: row.contractId,
    actorUserId: row.actorUserId,
    eventType: row.eventType,
    title: row.title,
    description: row.description,
    milestoneId: row.milestoneId,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

async function assertContractAccess(contractId: string, userId: string) {
  const [row] = await db.select().from(contract).where(eq(contract.id, contractId)).limit(1);

  if (!row) {
    throw new ContractNotFoundError();
  }

  if (row.hirerUserId !== userId && row.freelancerUserId !== userId) {
    throw new ContractForbiddenError();
  }

  return row;
}

export async function listContractTimeline(contractId: string, userId: string) {
  await assertContractAccess(contractId, userId);

  const rows = await db
    .select()
    .from(contractEvent)
    .where(eq(contractEvent.contractId, contractId))
    .orderBy(desc(contractEvent.createdAt));

  return {
    items: rows.map(serializeContractEvent),
    meta: { total: rows.length },
  };
}
