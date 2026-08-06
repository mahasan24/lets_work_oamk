import { createFileRoute } from "@tanstack/react-router";

import { DisputesList } from "@/components/disputes/disputes-list";

export const Route = createFileRoute("/dashboard/freelancer/disputes/")({
  component: FreelancerDisputesPage,
});

function FreelancerDisputesPage() {
  return <DisputesList role="freelancer" />;
}
