import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  component: () => <Outlet />,
});
