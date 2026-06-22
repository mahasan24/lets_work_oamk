import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import HirerDashboardLayout from "@/components/hirer/hirer-dashboard-layout";
import { getActiveRole } from "@/lib/dashboard-paths";

export const Route = createFileRoute("/dashboard/hirer")({
  component: HirerRouteLayout,
  beforeLoad: ({ context }) => {
    if (context.profile && getActiveRole(context.profile) !== "hirer") {
      redirect({ to: "/dashboard/freelancer", throw: true });
    }
  },
});

function HirerRouteLayout() {
  return (
    <HirerDashboardLayout>
      <Outlet />
    </HirerDashboardLayout>
  );
}
