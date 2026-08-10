import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { platformUser } from "@lets_work/db/schema/platform";
import { userVerification } from "@lets_work/db/schema/verification";
import { and, desc, eq, ilike, or } from "drizzle-orm";

import { BadRequestError, NotFoundError } from "./errors";
import { createNotification } from "./notifications";

export class AdminUserNotFoundError extends NotFoundError {
  constructor() {
    super("User not found", "USER_NOT_FOUND");
  }
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

export async function getAdminMe(userId: string) {
  const [[platform], [profile]] = await Promise.all([
    db.select().from(platformUser).where(eq(platformUser.userId, userId)).limit(1),
    db
      .select({
        suspendedAt: marketplaceUserProfile.suspendedAt,
        suspendReason: marketplaceUserProfile.suspendReason,
      })
      .from(marketplaceUserProfile)
      .where(eq(marketplaceUserProfile.userId, userId))
      .limit(1),
  ]);

  return {
    isAdmin: platform?.role === "admin",
    platformRole: platform?.role ?? null,
    suspendedAt: profile?.suspendedAt?.toISOString() ?? null,
    suspendReason: profile?.suspendReason ?? null,
  };
}

export async function searchAdminUsers(query: string) {
  const q = query.trim();
  if (q.length < 2) {
    throw new BadRequestError("Search query must be at least 2 characters", "SEARCH_QUERY");
  }

  const pattern = `%${q}%`;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      accountType: marketplaceUserProfile.accountType,
      activeRole: marketplaceUserProfile.activeRole,
      onboardingStep: marketplaceUserProfile.onboardingStep,
      profileCompletion: marketplaceUserProfile.profileCompletion,
      suspendedAt: marketplaceUserProfile.suspendedAt,
      suspendReason: marketplaceUserProfile.suspendReason,
      platformRole: platformUser.role,
      identityStatus: userVerification.status,
    })
    .from(user)
    .leftJoin(marketplaceUserProfile, eq(marketplaceUserProfile.userId, user.id))
    .leftJoin(platformUser, eq(platformUser.userId, user.id))
    .leftJoin(
      userVerification,
      and(eq(userVerification.userId, user.id), eq(userVerification.type, "identity")),
    )
    .where(or(ilike(user.email, pattern), ilike(user.name, pattern)))
    .orderBy(desc(user.createdAt))
    .limit(25);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    accountType: row.accountType,
    activeRole: row.activeRole,
    onboardingStep: row.onboardingStep,
    profileCompletion: row.profileCompletion,
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    suspendReason: row.suspendReason,
    platformRole: row.platformRole,
    identityStatus: row.identityStatus,
  }));
}

export async function setUserSuspended(
  targetUserId: string,
  actorUserId: string,
  input: { suspended: boolean; reason?: string },
) {
  if (targetUserId === actorUserId) {
    throw new BadRequestError("You cannot suspend your own account", "CANNOT_SUSPEND_SELF");
  }

  const [target] = await db.select().from(user).where(eq(user.id, targetUserId)).limit(1);
  if (!target) {
    throw new AdminUserNotFoundError();
  }

  const [platform] = await db
    .select()
    .from(platformUser)
    .where(eq(platformUser.userId, targetUserId))
    .limit(1);

  if (platform?.role === "admin" && input.suspended) {
    throw new BadRequestError("Admin accounts cannot be suspended", "CANNOT_SUSPEND_ADMIN");
  }

  const [profile] = await db
    .select()
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, targetUserId))
    .limit(1);

  if (!profile) {
    await db.insert(marketplaceUserProfile).values({
      userId: targetUserId,
      onboardingStep: "role_selection",
    });
  }

  const suspendedAt = input.suspended ? new Date() : null;
  const suspendReason = input.suspended ? input.reason?.trim() || "Suspended by admin" : null;

  const [updated] = await db
    .update(marketplaceUserProfile)
    .set({ suspendedAt, suspendReason })
    .where(eq(marketplaceUserProfile.userId, targetUserId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update suspension");
  }

  await notifyQuietly({
    userId: targetUserId,
    type: "system",
    title: input.suspended ? "Account suspended" : "Account reinstated",
    body: input.suspended ? suspendReason : "Your account access has been restored by an admin.",
    actionUrl: "/dashboard",
  });

  return {
    id: targetUserId,
    suspendedAt: updated.suspendedAt?.toISOString() ?? null,
    suspendReason: updated.suspendReason,
  };
}
