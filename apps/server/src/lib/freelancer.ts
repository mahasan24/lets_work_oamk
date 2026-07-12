import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";

import { ensureProfile } from "./profile";

function isFreelancerProfile(profile: typeof marketplaceUserProfile.$inferSelect) {
  if (profile.accountType === "freelancer") return true;
  if (profile.accountType === "both" && profile.activeRole === "freelancer") return true;
  return profile.activeRole === "freelancer";
}

export async function requireFreelancerProfile(userId: string) {
  const profile = await ensureProfile(userId);

  if (!isFreelancerProfile(profile)) {
    throw new FreelancerAccessError();
  }

  return profile;
}

export class FreelancerAccessError extends Error {
  constructor() {
    super("Freelancer account required");
    this.name = "FreelancerAccessError";
  }
}
