import { createFileRoute, redirect } from "@tanstack/react-router";

import { getDashboardHomePath } from "@/lib/dashboard-paths";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: ({ context }) => {
    redirect({ to: getDashboardHomePath(context.profile), throw: true });
  },
});
