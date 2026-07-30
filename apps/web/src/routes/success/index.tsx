import { buttonVariants } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PaymentsApiError, paymentsApi, type CheckoutSessionSummary } from "@/lib/payments-api";

export const Route = createFileRoute("/success/")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    checkout_id: typeof search.checkout_id === "string" ? search.checkout_id : undefined,
    contract_id: typeof search.contract_id === "string" ? search.contract_id : undefined,
    role: search.role === "freelancer" ? ("freelancer" as const) : ("hirer" as const),
  }),
});

function SuccessPage() {
  const { checkout_id, contract_id, role } = useSearch({ from: "/success/" });
  const [summary, setSummary] = useState<CheckoutSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(checkout_id));

  useEffect(() => {
    if (!checkout_id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void paymentsApi
      .getCheckoutSession(checkout_id)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof PaymentsApiError ? err.message : "Could not confirm payment");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [checkout_id]);

  const resolvedContractId = summary?.contractId ?? contract_id ?? null;
  const contractHref = resolvedContractId
    ? `/dashboard/${role}/contracts/${resolvedContractId}`
    : `/dashboard/${role}/contracts`;

  const funded =
    summary?.payment?.status === "held" ||
    summary?.payment?.status === "succeeded" ||
    summary?.paymentStatus === "paid";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{funded ? "Escrow funded" : "Payment received"}</CardTitle>
          <CardDescription>
            {funded
              ? "Milestone funds are held in escrow until you approve the deliverable."
              : "Confirming your Stripe Checkout session…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <Skeleton className="h-16 w-full" /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!isLoading && !error && summary?.payment ? (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">
                {summary.payment.currency === "USD" ? "$" : `${summary.payment.currency} `}
                {summary.payment.amount}
              </p>
              <p className="text-muted-foreground capitalize">Status: {summary.payment.status}</p>
            </div>
          ) : null}
          <Link
            to={contractHref}
            className={cn(buttonVariants(), "inline-flex w-full justify-center")}
          >
            Back to contract
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
