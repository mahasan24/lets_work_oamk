import { createFileRoute } from "@tanstack/react-router";

import { InvoicesList } from "@/components/invoices/invoices-list";

export const Route = createFileRoute("/dashboard/freelancer/invoices/")({
  component: FreelancerInvoicesPage,
});

function FreelancerInvoicesPage() {
  return <InvoicesList role="freelancer" />;
}
