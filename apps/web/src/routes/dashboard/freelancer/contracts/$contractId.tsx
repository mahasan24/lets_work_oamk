import { createFileRoute } from "@tanstack/react-router";

import { ContractDetail } from "@/components/contracts/contract-detail";

export const Route = createFileRoute("/dashboard/freelancer/contracts/$contractId")({
  component: FreelancerContractDetailPage,
});

function FreelancerContractDetailPage() {
  const { contractId } = Route.useParams();
  return (
    <ContractDetail
      contractId={contractId}
      role="freelancer"
      listPath="/dashboard/freelancer/contracts"
    />
  );
}
