import { createFileRoute } from "@tanstack/react-router";

import { ContractDetail } from "@/components/contracts/contract-detail";

export const Route = createFileRoute("/dashboard/hirer/contracts/$contractId")({
  component: HirerContractDetailPage,
});

function HirerContractDetailPage() {
  const { contractId } = Route.useParams();
  return (
    <ContractDetail
      contractId={contractId}
      role="hirer"
      listPath="/dashboard/hirer/contracts"
    />
  );
}
