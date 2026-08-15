import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin/")({
  beforeLoad: () => {
    redirect({ to: "/admin", throw: true });
  },
});
