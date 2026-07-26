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

/**
 * Hirers (and dual accounts) can post jobs and browse talent.
 * Freelancer-only accounts cannot.
 */
export function canHireTalent(profile: ProfileBundle | null | undefined) {
  if (!profile) return false;
  const type = profile.profile.accountType;
  return type === "hirer" || type === "both";
}

/**
 * Freelancers (and dual accounts) can browse jobs and apply.
 * Hirer-only accounts cannot.
 */
export function canFindWork(profile: ProfileBundle | null | undefined) {
  if (!profile) return false;
  const type = profile.profile.accountType;
  return type === "freelancer" || type === "both";
}

/**
 * Whether the current UI should expose hire / find-talent actions.
 * Dual accounts only see these while acting as a hirer.
 */
export function shouldShowHireActions(profile: ProfileBundle | null | undefined) {
  if (!canHireTalent(profile)) return false;
  if (profile?.profile.accountType === "both") {
    return profile.profile.activeRole === "hirer";
  }
  return true;
}

/**
 * Whether the current UI should expose find-work / apply actions.
 * Dual accounts only see these while acting as a freelancer.
 */
export function shouldShowFindWorkActions(profile: ProfileBundle | null | undefined) {
  if (!canFindWork(profile)) return false;
  if (profile?.profile.accountType === "both") {
    return profile.profile.activeRole === "freelancer";
  }
  return true;
}

export function getOnboardingRedirectPath(
  profile: ProfileBundle | null | undefined,
  _pathname: string,
): string | null {
  if (!profile) return null;

  // Role selection is the only hard prerequisite: without a role we can't know
  // which dashboard to render. Everything else (profile completion, identity
  // verification) is surfaced via a banner, not a gate, so the user always has
  // full access to their dashboard.
  if (profile.profile.onboardingStep === "role_selection") {
    return "/dashboard/onboarding/role";
  }

  return null;
}

export function shouldShowOnboardingBanner(profile: ProfileBundle | null | undefined) {
  if (!profile) return false;
  const step = profile.profile.onboardingStep;
  return step === "profile" || step === "verification";
}
