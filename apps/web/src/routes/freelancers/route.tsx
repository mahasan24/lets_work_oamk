import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { getDashboardHomePath, shouldShowHireActions } from "@/lib/dashboard-paths";
import { profileApi } from "@/lib/profile-api";

export const Route = createFileRoute("/freelancers")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) return;

    const profile = await profileApi.getMe().catch(() => null);
    // Freelancer-only (and dual accounts acting as freelancers) should not use
    // the talent directory as a hiring surface.
    if (profile && !shouldShowHireActions(profile)) {
      redirect({ to: getDashboardHomePath(profile), throw: true });
    }
  },
  component: () => (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <Outlet />
    </div>
  ),
});
