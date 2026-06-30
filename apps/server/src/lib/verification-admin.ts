import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { userVerification } from "@lets_work/db/schema/verification";
import { and, desc, eq } from "drizzle-orm";

import { refreshProfileCompletion } from "./profile";

export class VerificationNotFoundError extends Error {
  constructor() {
    super("Verification not found");
    this.name = "VerificationNotFoundError";
  }
}

export async function listPendingVerifications() {
  const rows = await db
    .select({
      id: userVerification.id,
      userId: userVerification.userId,
      type: userVerification.type,
      status: userVerification.status,
      label: userVerification.label,
      createdAt: userVerification.createdAt,
      userName: user.name,
      userEmail: user.email,
      accountType: marketplaceUserProfile.accountType,
      activeRole: marketplaceUserProfile.activeRole,
      profileCompletion: marketplaceUserProfile.profileCompletion,
    })
    .from(userVerification)
    .innerJoin(user, eq(user.id, userVerification.userId))
    .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, userVerification.userId))
    .where(
      and(
        eq(userVerification.type, "identity"),
        eq(userVerification.status, "pending"),
      ),
    )
    .orderBy(desc(userVerification.createdAt));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    type: row.type,
    status: row.status,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    user: {
      name: row.userName,
      email: row.userEmail,
      accountType: row.accountType,
      activeRole: row.activeRole,
      profileCompletion: row.profileCompletion,
    },
  }));
}

async function getVerificationById(verificationId: string) {
  const [row] = await db
    .select()
    .from(userVerification)
    .where(eq(userVerification.id, verificationId))
    .limit(1);

  if (!row) {
    throw new VerificationNotFoundError();
  }

  return row;
}

export async function approveVerification(verificationId: string) {
  const existing = await getVerificationById(verificationId);

  if (existing.status !== "pending") {
    throw new Error("Only pending verifications can be approved");
  }

  const [updated] = await db
    .update(userVerification)
    .set({
      status: "verified",
      verifiedAt: new Date(),
    })
    .where(eq(userVerification.id, verificationId))
    .returning();

  if (!updated) {
    throw new Error("Failed to approve verification");
  }

  await db
    .update(marketplaceUserProfile)
    .set({ onboardingStep: "complete" })
    .where(eq(marketplaceUserProfile.userId, existing.userId));

  await refreshProfileCompletion(existing.userId);

  return {
    id: updated.id,
    userId: updated.userId,
    status: updated.status,
    verifiedAt: updated.verifiedAt?.toISOString() ?? null,
  };
}

export async function rejectVerification(verificationId: string, reason?: string) {
  const existing = await getVerificationById(verificationId);

  if (existing.status !== "pending") {
    throw new Error("Only pending verifications can be rejected");
  }

  const [updated] = await db
    .update(userVerification)
    .set({
      status: "rejected",
      metadata: reason?.trim() || null,
    })
    .where(eq(userVerification.id, verificationId))
    .returning();

  if (!updated) {
    throw new Error("Failed to reject verification");
  }

  await db
    .update(marketplaceUserProfile)
    .set({ onboardingStep: "verification" })
    .where(eq(marketplaceUserProfile.userId, existing.userId));

  return {
    id: updated.id,
    userId: updated.userId,
    status: updated.status,
    reason: updated.metadata,
  };
}
