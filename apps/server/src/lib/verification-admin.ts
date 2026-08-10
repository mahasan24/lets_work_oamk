import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { userVerification } from "@lets_work/db/schema/verification";
import { and, desc, eq } from "drizzle-orm";

import { ConflictError, NotFoundError } from "./errors";
import { createNotification } from "./notifications";
import { refreshProfileCompletion } from "./profile";

export class VerificationNotFoundError extends NotFoundError {
  constructor() {
    super("Verification not found", "VERIFICATION_NOT_FOUND");
  }
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
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
      headline: marketplaceUserProfile.headline,
      companyName: marketplaceUserProfile.companyName,
      hirerType: marketplaceUserProfile.hirerType,
      country: marketplaceUserProfile.country,
      city: marketplaceUserProfile.city,
    })
    .from(userVerification)
    .innerJoin(user, eq(user.id, userVerification.userId))
    .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, userVerification.userId))
    .where(and(eq(userVerification.type, "identity"), eq(userVerification.status, "pending")))
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
      headline: row.headline,
      companyName: row.companyName,
      hirerType: row.hirerType,
      country: row.country,
      city: row.city,
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
    throw new ConflictError("Only pending verifications can be approved", "VERIFICATION_STATUS");
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

  await notifyQuietly({
    userId: existing.userId,
    type: "system",
    title: "Identity verified",
    body: "An admin approved your identity verification. Your profile badge is now verified.",
    actionUrl: "/dashboard/hirer/profile",
  });

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
    throw new ConflictError("Only pending verifications can be rejected", "VERIFICATION_STATUS");
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

  const reasonText = reason?.trim();
  await notifyQuietly({
    userId: existing.userId,
    type: "system",
    title: "Identity verification rejected",
    body: reasonText
      ? `Your verification was rejected: ${reasonText}`
      : "Your identity verification was rejected. Update your profile and resubmit.",
    actionUrl: "/dashboard/hirer/profile",
  });

  return {
    id: updated.id,
    userId: updated.userId,
    status: updated.status,
    reason: updated.metadata,
  };
}
