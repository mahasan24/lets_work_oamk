import { createFileRoute, Outlet } from "@tanstack/react-router";

import PublicMarketingShell from "@/components/public/public-marketing-shell";

export const Route = createFileRoute("/clients")({
  component: () => (
    <PublicMarketingShell>
      <Outlet />
    </PublicMarketingShell>
  ),
});
