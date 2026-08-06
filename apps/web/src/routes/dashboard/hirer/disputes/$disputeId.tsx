import { createFileRoute } from "@tanstack/react-router";

import { DisputeDetailView } from "@/components/disputes/dispute-detail";

export const Route = createFileRoute("/dashboard/hirer/disputes/$disputeId")({
  component: HirerDisputeDetailPage,
});

function HirerDisputeDetailPage() {
  const { disputeId } = Route.useParams();
  return <DisputeDetailView disputeId={disputeId} role="hirer" />;
}
