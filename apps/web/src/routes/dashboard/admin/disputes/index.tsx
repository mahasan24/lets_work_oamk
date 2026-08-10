import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin/disputes/")({
  beforeLoad: () => {
    redirect({ to: "/admin/disputes", throw: true });
  },
});
