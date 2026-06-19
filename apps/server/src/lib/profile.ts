import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { certification } from "@lets_work/db/schema/certifications";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { portfolioItem, workHistory } from "@lets_work/db/schema/portfolio";
import { eq } from "drizzle-orm";

type ProfileBundle = {
  user: { id: string; name: string; email: string; image: string | null };
  profile: typeof marketplaceUserProfile.$inferSelect;
  portfolio: (typeof portfolioItem.$inferSelect)[];
  certifications: (typeof certification.$inferSelect)[];
  experience: (typeof workHistory.$inferSelect)[];
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
    .values({ userId })
    .returning();

  if (!created) {
    throw new Error("Failed to create profile");
  }

  return created;
}

export function calculateProfileCompletion(data: {
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

export async function getProfileBundle(userId: string): Promise<ProfileBundle> {
  const [dbUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

  if (!dbUser) {
    throw new Error("User not found");
  }

  const profile = await ensureProfile(userId);

  const [portfolio, certifications, experience] = await Promise.all([
    db.select().from(portfolioItem).where(eq(portfolioItem.userId, userId)),
    db.select().from(certification).where(eq(certification.userId, userId)),
    db.select().from(workHistory).where(eq(workHistory.userId, userId)),
  ]);

  const profileCompletion = calculateProfileCompletion({
    profile,
    user: dbUser,
    portfolioCount: portfolio.length,
    certificationCount: certifications.length,
    experienceCount: experience.length,
  });

  if (profile.profileCompletion !== profileCompletion) {
    await db
      .update(marketplaceUserProfile)
      .set({ profileCompletion })
      .where(eq(marketplaceUserProfile.userId, userId));
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
    },
    profile: { ...profile, profileCompletion },
    portfolio,
    certifications,
    experience,
    profileCompletion,
  };
}

export async function refreshProfileCompletion(userId: string) {
  const bundle = await getProfileBundle(userId);
  return bundle.profileCompletion;
}
