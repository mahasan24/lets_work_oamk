import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin/users/")({
  beforeLoad: () => {
    redirect({ to: "/admin/users", throw: true });
  },
});
