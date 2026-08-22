import { Badge } from "@lets_work/ui/components/badge";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowRightIcon, CheckCircle2Icon, LockIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  formatPaymentAmount,
  PaymentsApiError,
  paymentsApi,
  type CheckoutSessionSummary,
} from "@/lib/payments-api";

export const Route = createFileRoute("/success/")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    checkout_id: typeof search.checkout_id === "string" ? search.checkout_id : undefined,
    contract_id: typeof search.contract_id === "string" ? search.contract_id : undefined,
    role: search.role === "freelancer" ? ("freelancer" as const) : ("hirer" as const),
  }),
});

function statusLabel(status: string) {
  switch (status) {
    case "held":
      return "Held in escrow";
    case "succeeded":
      return "Succeeded";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return status.replaceAll("_", " ");
  }
}

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
  const paymentsHref = `/dashboard/${role}/payments`;

  const funded =
    summary?.payment?.status === "held" ||
    summary?.payment?.status === "succeeded" ||
    summary?.paymentStatus === "paid";

  const amountLabel = summary?.payment ? formatPaymentAmount(summary.payment) : null;

  return (
    <div className="relative min-h-full overflow-hidden bg-[radial-gradient(ellipse_at_top,_oklch(0.97_0.02_145)_0%,_oklch(0.96_0.01_250)_45%,_oklch(0.94_0.01_80)_100%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.22_0.03_145)_0%,_oklch(0.18_0.02_250)_55%,_oklch(0.16_0.01_80)_100%)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid items-stretch gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-center gap-6 rounded-2xl border border-border/70 bg-background/90 p-8 shadow-sm backdrop-blur-sm sm:p-10">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-full border",
                  funded
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {funded ? (
                  <CheckCircle2Icon className="size-7" aria-hidden />
                ) : (
                  <ShieldCheckIcon className="size-7" aria-hidden />
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Stripe checkout
                </p>
                <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                  {error
                    ? "Payment confirmation issue"
                    : funded
                      ? "Escrow funded"
                      : "Confirming payment"}
                </h1>
                <p className="max-w-xl text-base text-muted-foreground">
                  {error
                    ? "We could not verify this Checkout session yet. You can return to the contract and refresh — the webhook may still be processing."
                    : funded
                      ? "Milestone funds are held securely until you approve the deliverable. The freelancer can start work once the milestone is funded."
                      : "We’re confirming your Stripe Checkout session. This usually takes a few seconds."}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-12 w-48 rounded-lg" />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!isLoading && !error && summary?.payment ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/40 p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Amount held
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
                    {amountLabel}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Escrow status
                  </p>
                  <div className="mt-3">
                    <Badge variant={funded ? "default" : "secondary"} className="capitalize">
                      {statusLabel(summary.payment.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Funds stay locked until you approve milestone work.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={contractHref}
                className={cn(buttonVariants({ size: "lg" }), "inline-flex justify-center gap-2")}
              >
                Back to contract
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
              <Link
                to={paymentsHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "inline-flex justify-center",
                )}
              >
                View payments
              </Link>
            </div>
          </section>

          <aside className="flex flex-col justify-between gap-6 rounded-2xl border border-border/70 bg-background/70 p-8 shadow-sm backdrop-blur-sm sm:p-10">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <LockIcon className="size-3.5" aria-hidden />
                Escrow protection
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                What happens next
              </h2>
              <ol className="space-y-4 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    1
                  </span>
                  <span>
                    The freelancer starts the funded milestone and submits deliverables when ready.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    2
                  </span>
                  <span>You review the work and approve — or request a revision if needed.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    3
                  </span>
                  <span>On approval, escrow is released and the freelancer can claim payout.</span>
                </li>
              </ol>
            </div>

            <p className="border-t pt-5 text-xs leading-relaxed text-muted-foreground">
              This page confirms your Stripe test or live Checkout return. If the amount still shows
              as pending, refresh the contract after a few seconds while the webhook settles.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
