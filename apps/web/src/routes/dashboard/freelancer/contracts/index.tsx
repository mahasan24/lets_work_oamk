import { createFileRoute } from "@tanstack/react-router";

import { ContractsList } from "@/components/contracts/contracts-list";

export const Route = createFileRoute("/dashboard/freelancer/contracts/")({
  component: FreelancerContractsPage,
});

function FreelancerContractsPage() {
  return (
    <ContractsList role="freelancer" detailBasePath="/dashboard/freelancer/contracts" />
  );
}
