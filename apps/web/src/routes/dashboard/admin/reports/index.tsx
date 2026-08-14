import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin/reports/")({
  beforeLoad: () => {
    redirect({ to: "/admin/reports", throw: true });
  },
});
