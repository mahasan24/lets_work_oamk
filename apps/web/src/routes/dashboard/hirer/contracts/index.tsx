import { createFileRoute } from "@tanstack/react-router";

import { ContractsList } from "@/components/contracts/contracts-list";

export const Route = createFileRoute("/dashboard/hirer/contracts/")({
  component: HirerContractsPage,
});

function HirerContractsPage() {
  return <ContractsList role="hirer" detailBasePath="/dashboard/hirer/contracts" />;
}
