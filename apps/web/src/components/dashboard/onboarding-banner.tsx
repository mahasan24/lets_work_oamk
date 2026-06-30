import { Alert, AlertDescription, AlertTitle } from "@lets_work/ui/components/alert";
import { Button } from "@lets_work/ui/components/button";
import { Link } from "@tanstack/react-router";

import { getProfilePath, type MarketplaceRole } from "@/lib/dashboard-paths";
import type { ProfileBundle } from "@/lib/profile-api";

type OnboardingBannerProps = {
  profile: ProfileBundle;
  role: MarketplaceRole;
};

export function OnboardingBanner({ profile, role }: OnboardingBannerProps) {
  const step = profile.profile.onboardingStep;
  const profilePath = getProfilePath(profile);

  if (step === "complete" || step === "role_selection") {
    return null;
  }

  const identity = profile.verifications.find((item) => item.type === "identity");

  if (step === "profile") {
    return (
      <Alert>
        <AlertTitle>Complete your {role === "hirer" ? "client" : "freelancer"} profile</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            You&apos;re {profile.profileCompletion}% done. Finish your profile to unlock the full
            dashboard.
          </span>
          <Button render={<Link to={profilePath} />} nativeButton={false} size="sm">
            Continue setup
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (step === "verification") {
    const message =
      identity?.status === "pending"
        ? "Your identity verification is pending admin review."
        : identity?.status === "rejected"
          ? "Your verification was rejected. Update your profile and resubmit."
          : "Submit your profile for identity verification to finish onboarding.";

    return (
      <Alert>
        <AlertTitle>Identity verification</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{message}</span>
          <Button render={<Link to={profilePath} />} nativeButton={false} size="sm" variant="outline">
            {identity?.status === "pending" ? "View status" : "Verify identity"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
