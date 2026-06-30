import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { getDashboardHomePath, getOnboardingRedirectPath } from "@/lib/dashboard-paths";
import { profileApi } from "@/lib/profile-api";

export const Route = createFileRoute("/dashboard")({
  component: () => <Outlet />,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }

    const profile = await profileApi.getMe().catch(() => null);

    const onboardingRedirect = getOnboardingRedirectPath(profile, location.pathname);
    if (onboardingRedirect) {
      redirect({ to: onboardingRedirect, throw: true });
    }

    const isDashboardRoot =
      location.pathname === "/dashboard" || location.pathname === "/dashboard/";

    if (isDashboardRoot && profile) {
      redirect({ to: getDashboardHomePath(profile), throw: true });
    }

    return { session, profile };
  },
});
