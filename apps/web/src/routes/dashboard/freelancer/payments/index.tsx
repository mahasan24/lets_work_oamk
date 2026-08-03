import { createFileRoute } from "@tanstack/react-router";

import { PaymentsLedger } from "@/components/payments/payments-ledger";

export const Route = createFileRoute("/dashboard/freelancer/payments/")({
  component: FreelancerPaymentsPage,
  validateSearch: (search: Record<string, unknown>): { connect?: "return" | "refresh" } => {
    if (search.connect === "return" || search.connect === "refresh") {
      return { connect: search.connect };
    }
    return {};
  },
});

function FreelancerPaymentsPage() {
  return <PaymentsLedger role="freelancer" />;
}
