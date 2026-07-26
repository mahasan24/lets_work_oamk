import { createFileRoute } from "@tanstack/react-router";

import { MyProposals } from "@/components/freelancer/my-proposals";

export const Route = createFileRoute("/dashboard/freelancer/proposals")({
  component: FreelancerProposalsPage,
});

function FreelancerProposalsPage() {
  return <MyProposals />;
}
