import { createFileRoute } from "@tanstack/react-router";

import { DisputeDetailView } from "@/components/disputes/dispute-detail";

export const Route = createFileRoute("/dashboard/freelancer/disputes/$disputeId")({
  component: FreelancerDisputeDetailPage,
});

function FreelancerDisputeDetailPage() {
  const { disputeId } = Route.useParams();
  return <DisputeDetailView disputeId={disputeId} role="freelancer" />;
}
