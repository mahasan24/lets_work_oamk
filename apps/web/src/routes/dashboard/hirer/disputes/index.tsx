import { createFileRoute } from "@tanstack/react-router";

import { DisputesList } from "@/components/disputes/disputes-list";

export const Route = createFileRoute("/dashboard/hirer/disputes/")({
  component: HirerDisputesPage,
});

function HirerDisputesPage() {
  return <DisputesList role="hirer" />;
}
