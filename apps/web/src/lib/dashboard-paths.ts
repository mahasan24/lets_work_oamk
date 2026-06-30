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

const PROFILE_COMPLETE_THRESHOLD = 80;

export function getOnboardingRedirectPath(
  profile: ProfileBundle | null | undefined,
  pathname: string,
): string | null {
  if (!profile) return null;

  const step = profile.profile.onboardingStep;

  if (step === "role_selection") {
    return "/dashboard/onboarding/role";
  }

  if (step === "profile" && profile.profileCompletion < PROFILE_COMPLETE_THRESHOLD) {
    const profilePath = getProfilePath(profile);
    if (
      !pathname.startsWith(profilePath) &&
      !pathname.startsWith("/dashboard/onboarding") &&
      !pathname.startsWith("/dashboard/admin")
    ) {
      return profilePath;
    }
  }

  return null;
}

export function shouldShowOnboardingBanner(profile: ProfileBundle | null | undefined) {
  if (!profile) return false;
  const step = profile.profile.onboardingStep;
  return step === "profile" || step === "verification";
}
