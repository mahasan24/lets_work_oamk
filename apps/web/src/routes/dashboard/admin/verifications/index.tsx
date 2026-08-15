import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin/verifications/")({
  beforeLoad: () => {
    redirect({ to: "/admin/verifications", throw: true });
  },
});
