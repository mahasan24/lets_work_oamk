import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/clients")({
  component: () => (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <Outlet />
    </div>
  ),
});
