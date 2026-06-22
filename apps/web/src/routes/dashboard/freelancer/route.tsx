import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import FreelancerDashboardLayout from "@/components/dashboard/freelancer-dashboard-layout";
import { getActiveRole } from "@/lib/dashboard-paths";

export const Route = createFileRoute("/dashboard/freelancer")({
  component: FreelancerRouteLayout,
  beforeLoad: ({ context }) => {
    if (context.profile && getActiveRole(context.profile) !== "freelancer") {
      redirect({ to: "/dashboard/hirer", throw: true });
    }
  },
});

function FreelancerRouteLayout() {
  return (
    <FreelancerDashboardLayout>
      <Outlet />
    </FreelancerDashboardLayout>
  );
}
