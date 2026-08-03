import { createFileRoute } from "@tanstack/react-router";

import { InvoicesList } from "@/components/invoices/invoices-list";

export const Route = createFileRoute("/dashboard/hirer/invoices/")({
  component: HirerInvoicesPage,
});

function HirerInvoicesPage() {
  return <InvoicesList role="hirer" />;
}
