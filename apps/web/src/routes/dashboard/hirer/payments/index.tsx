import { createFileRoute } from "@tanstack/react-router";

import { PaymentsLedger } from "@/components/payments/payments-ledger";

export const Route = createFileRoute("/dashboard/hirer/payments/")({
  component: HirerPaymentsPage,
});

function HirerPaymentsPage() {
  return <PaymentsLedger role="hirer" />;
}
