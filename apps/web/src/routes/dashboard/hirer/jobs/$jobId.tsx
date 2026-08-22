import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/hirer/jobs/$jobId")({
  component: HirerJobLayout,
});

function HirerJobLayout() {
  return <Outlet />;
}
