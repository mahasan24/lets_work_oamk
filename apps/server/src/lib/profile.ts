import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { certification } from "@lets_work/db/schema/certifications";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { portfolioItem, workHistory } from "@lets_work/db/schema/portfolio";
import { userVerification } from "@lets_work/db/schema/verification";
import { and, eq } from "drizzle-orm";

const PROFILE_COMPLETE_THRESHOLD = 80;

type ProfileBundle = {
  user: { id: string; name: string; email: string; image: string | null };
  profile: typeof marketplaceUserProfile.$inferSelect;
  portfolio: (typeof portfolioItem.$inferSelect)[];
  certifications: (typeof certification.$inferSelect)[];
  experience: (typeof workHistory.$inferSelect)[];
  verifications: (typeof userVerification.$inferSelect)[];
  profileCompletion: number;
};

export async function ensureProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(marketplaceUserProfile)
    .where(eq(marketplaceUserProfile.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(marketplaceUserProfile)
    .values({ userId, onboardingStep: "role_selection" })
    .returning();

  if (!created) {
    throw new Error("Failed to create profile");
  }

  return created;
}

function isHirerProfile(profile: typeof marketplaceUserProfile.$inferSelect) {
  return profile.accountType === "hirer" || profile.activeRole === "hirer";
}

export function calculateFreelancerProfileCompletion(data: {
  profile: typeof marketplaceUserProfile.$inferSelect;
  user: { image: string | null };
  portfolioCount: number;
  certificationCount: number;
  experienceCount: number;
}) {
  const checks = [
    Boolean(data.profile.avatarUrl || data.user.image),
    Boolean(data.profile.headline?.trim()),
    Boolean(data.profile.bio?.trim() && data.profile.bio.length >= 40),
    data.profile.hourlyRate != null,
    Boolean(data.profile.country?.trim()),
    Boolean(data.profile.city?.trim()),
    Array.isArray(data.profile.skills) && data.profile.skills.length > 0,
    Boolean(data.profile.videoIntroUrl?.trim()),
    data.profile.availabilityStatus !== "unavailable" || data.profile.hoursPerWeek != null,
    data.portfolioCount > 0,
    data.certificationCount > 0,
    data.experienceCount > 0,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function calculateHirerProfileCompletion(data: {
  profile: typeof marketplaceUserProfile.$inferSelect;
  user: { image: string | null };
  hasIdentityVerification: boolean;
}) {
  const isCompany = data.profile.hirerType === "company";
  const checks = [
    Boolean(data.profile.avatarUrl || data.user.image),
    Boolean(data.profile.hirerType),
    Boolean(data.profile.headline?.trim()),
    Boolean(data.profile.country?.trim()),
    Boolean(data.profile.city?.trim()),
    Boolean(data.profile.timezone?.trim()),
    Boolean(data.profile.phoneNumber?.trim()),
    Array.isArray(data.profile.jobCategories) && data.profile.jobCategories.length > 0,
    isCompany
      ? Boolean(data.profile.companyName?.trim())
      : Boolean(data.profile.bio?.trim() && data.profile.bio.length >= 40),
    isCompany ? Boolean(data.profile.companyWebsite?.trim()) : true,
    isCompany
      ? Boolean(data.profile.companyDescription?.trim() && data.profile.companyDescription.length >= 40)
      : true,
    data.hasIdentityVerification,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function calculateProfileCompletion(data: {
  profile: typeof marketplaceUserProfile.$inferSelect;
  user: { image: string | null };
  portfolioCount: number;
  certificationCount: number;
  experienceCount: number;
  hasIdentityVerification: boolean;
}) {
  if (isHirerProfile(data.profile)) {
    return calculateHirerProfileCompletion({
      profile: data.profile,
      user: data.user,
      hasIdentityVerification: data.hasIdentityVerification,
    });
  }

  return calculateFreelancerProfileCompletion({
    profile: data.profile,
    user: data.user,
    portfolioCount: data.portfolioCount,
    certificationCount: data.certificationCount,
    experienceCount: data.experienceCount,
  });
}

function resolveOnboardingStep(
  profile: typeof marketplaceUserProfile.$inferSelect,
  verifications: (typeof userVerification.$inferSelect)[],
  profileCompletion: number,
) {
  if (profile.onboardingStep === "role_selection") {
    return "role_selection" as const;
  }

  const identity = verifications.find((item) => item.type === "identity");

  if (profileCompletion < PROFILE_COMPLETE_THRESHOLD) {
    return "profile" as const;
  }

  if (identity?.status === "verified") {
    return "complete" as const;
  }

  return "verification" as const;
}

export async function getProfileBundle(userId: string): Promise<ProfileBundle> {
  const [dbUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

  if (!dbUser) {
    throw new Error("User not found");
  }

  const profile = await ensureProfile(userId);

  const [portfolio, certifications, experience, verifications] = await Promise.all([
    db.select().from(portfolioItem).where(eq(portfolioItem.userId, userId)),
    db.select().from(certification).where(eq(certification.userId, userId)),
    db.select().from(workHistory).where(eq(workHistory.userId, userId)),
    db.select().from(userVerification).where(eq(userVerification.userId, userId)),
  ]);

  const hasIdentityVerification = verifications.some(
    (item) =>
      item.type === "identity" && (item.status === "pending" || item.status === "verified"),
  );

  const profileCompletion = calculateProfileCompletion({
    profile,
    user: dbUser,
    portfolioCount: portfolio.length,
    certificationCount: certifications.length,
    experienceCount: experience.length,
    hasIdentityVerification,
  });

  if (profile.profileCompletion !== profileCompletion) {
    await db
      .update(marketplaceUserProfile)
      .set({ profileCompletion })
      .where(eq(marketplaceUserProfile.userId, userId));
  }

  const onboardingStep = resolveOnboardingStep(profile, verifications, profileCompletion);

  if (onboardingStep !== profile.onboardingStep) {
    await db
      .update(marketplaceUserProfile)
      .set({ onboardingStep })
      .where(eq(marketplaceUserProfile.userId, userId));
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
    },
    profile: { ...profile, profileCompletion, onboardingStep },
    portfolio,
    certifications,
    experience,
    verifications,
    profileCompletion,
  };
}

export async function refreshProfileCompletion(userId: string) {
  const bundle = await getProfileBundle(userId);
  return bundle.profileCompletion;
}

export async function initializeProfileRole(
  userId: string,
  accountType: "hirer" | "freelancer",
) {
  const profile = await ensureProfile(userId);

  if (profile.onboardingStep !== "role_selection") {
    const isFreshProfile =
      profile.profileCompletion === 0 &&
      !profile.headline?.trim() &&
      !profile.hirerType &&
      !profile.companyName?.trim();

    if (!isFreshProfile && profile.accountType !== accountType) {
      return getProfileBundle(userId);
    }
  }

  await db
    .update(marketplaceUserProfile)
    .set({
      accountType,
      activeRole: accountType,
      onboardingStep: "profile",
    })
    .where(eq(marketplaceUserProfile.userId, userId));

  return getProfileBundle(userId);
}

export async function submitIdentityVerification(userId: string) {
  const [existing] = await db
    .select()
    .from(userVerification)
    .where(and(eq(userVerification.userId, userId), eq(userVerification.type, "identity")))
    .limit(1);

  if (!existing) {
    await db.insert(userVerification).values({
      id: crypto.randomUUID(),
      userId,
      type: "identity",
      status: "pending",
      label: "Government ID",
    });
  }

  await db
    .update(marketplaceUserProfile)
    .set({ onboardingStep: "verification" })
    .where(eq(marketplaceUserProfile.userId, userId));

  return getProfileBundle(userId);
}
