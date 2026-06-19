import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { authClient } from "@/lib/auth-client";
import { profileApi } from "@/lib/profile-api";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRouteLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }

    const profile = await profileApi.getMe().catch(() => null);

    return { session, profile };
  },
});

function DashboardRouteLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
