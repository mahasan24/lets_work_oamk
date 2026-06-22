import type { ProfileBundle } from "@/lib/profile-api";

export type MarketplaceRole = "freelancer" | "hirer";

export function getActiveRole(profile: ProfileBundle | null | undefined): MarketplaceRole {
  if (!profile) return "freelancer";
  if (profile.profile.accountType === "hirer") return "hirer";
  if (profile.profile.accountType === "freelancer") return "freelancer";
  return profile.profile.activeRole;
}

export function getDashboardHomePath(profile: ProfileBundle | null | undefined) {
  return getActiveRole(profile) === "hirer" ? "/dashboard/hirer" : "/dashboard/freelancer";
}

export function getProfilePath(profile: ProfileBundle | null | undefined) {
  return getActiveRole(profile) === "hirer"
    ? "/dashboard/hirer/profile"
    : "/dashboard/freelancer/profile";
}
