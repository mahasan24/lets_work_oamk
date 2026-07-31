import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatRelativeJobDate } from "@/lib/job-utils";
import {
  formatPaymentAmount,
  getPayoutStatusLabel,
  PaymentsApiError,
  paymentsApi,
  type ConnectStatusResponse,
  type PaymentListItem,
  type PaymentStatus,
  type PayoutStatus,
} from "@/lib/payments-api";

type PaymentsLedgerProps = {
  role: "hirer" | "freelancer";
};

const STATUS_FILTERS: Array<{ value: "all" | PaymentStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "held", label: "In escrow" },
  { value: "succeeded", label: "Released" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

function payoutBadgeVariant(status: PayoutStatus) {
  switch (status) {
    case "paid_out":
      return "default" as const;
    case "in_escrow":
    case "awaiting_payout":
      return "secondary" as const;
    case "failed":
    case "refunded":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function PaymentsLedger({ role }: PaymentsLedgerProps) {
  const search = useSearch({ strict: false }) as { connect?: string };
  const [items, setItems] = useState<PaymentListItem[]>([]);
  const [summary, setSummary] = useState({ awaitingPayout: 0, inEscrow: 0, paidOut: 0 });
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [connect, setConnect] = useState<ConnectStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const listPromise = paymentsApi.list({
        status: status === "all" ? undefined : status,
        role: role === "hirer" ? "payer" : "payee",
        limit: 50,
      });
      const connectPromise =
        role === "freelancer" ? paymentsApi.getConnectStatus() : Promise.resolve(null);

      const [list, connectStatus] = await Promise.all([listPromise, connectPromise]);
      setItems(list.items);
      setSummary(list.summary);
      setConnect(connectStatus);
    } catch {
      toast.error("Failed to load payments");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [role, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (role !== "freelancer") return;
    if (search.connect === "return" || search.connect === "refresh") {
      void paymentsApi
        .getConnectStatus()
        .then(setConnect)
        .catch(() => undefined);
      if (search.connect === "return") {
        toast.success("Stripe Connect status updated");
      }
    }
  }, [role, search.connect]);

  const startOnboarding = () => {
    startTransition(async () => {
      try {
        const result = await paymentsApi.startConnectOnboarding();
        window.location.assign(result.onboardingUrl);
      } catch (error) {
        toast.error(
          error instanceof PaymentsApiError ? error.message : "Failed to start onboarding",
        );
      }
    });
  };

  const claimPending = () => {
    startTransition(async () => {
      try {
        const result = await paymentsApi.transferPending();
        toast.success(
          result.transferredCount > 0
            ? `Transferred ${result.transferredCount} payout${result.transferredCount === 1 ? "" : "s"}`
            : "No pending payouts to transfer",
        );
        await load();
      } catch (error) {
        toast.error(
          error instanceof PaymentsApiError ? error.message : "Failed to transfer payouts",
        );
      }
    });
  };

  const transferOne = (paymentId: string) => {
    startTransition(async () => {
      try {
        await paymentsApi.transferPayment(paymentId);
        toast.success("Payout transferred");
        await load();
      } catch (error) {
        toast.error(error instanceof PaymentsApiError ? error.message : "Transfer failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {role === "hirer"
            ? "Escrow funding and release history for milestones you pay for."
            : "Earnings, escrow holds, and Stripe Connect payouts."}
        </p>
      </div>

      {role === "freelancer" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout account</CardTitle>
            <CardDescription>
              Connect Stripe to receive milestone funds after clients approve work.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              {connect?.connected && connect.account?.readyForPayouts ? (
                <p>
                  Connected · payouts enabled
                  <span className="block text-muted-foreground">
                    Account {connect.account.stripeAccountId}
                  </span>
                </p>
              ) : connect?.connected ? (
                <p>
                  Onboarding incomplete
                  <span className="block text-muted-foreground">
                    Finish Stripe setup to withdraw released escrow.
                  </span>
                </p>
              ) : (
                <p>
                  Not connected
                  <span className="block text-muted-foreground">
                    Required before released funds can leave platform escrow.
                  </span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!connect?.connected || !connect.account?.readyForPayouts ? (
                <Button type="button" size="sm" disabled={isPending} onClick={startOnboarding}>
                  {connect?.connected ? "Continue setup" : "Set up payouts"}
                </Button>
              ) : null}
              {connect?.connected &&
              connect.account?.readyForPayouts &&
              summary.awaitingPayout > 0 ? (
                <Button type="button" size="sm" disabled={isPending} onClick={claimPending}>
                  Claim {summary.awaitingPayout} pending
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In escrow</p>
            <p className="text-xl font-semibold">{summary.inEscrow}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Awaiting payout</p>
            <p className="text-xl font-semibold">{summary.awaitingPayout}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paid out</p>
            <p className="text-xl font-semibold">{summary.paidOut}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={status === filter.value ? "default" : "outline"}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No payments yet</p>
            <p className="text-sm text-muted-foreground">
              {role === "hirer"
                ? "Fund a milestone from a contract to see escrow activity here."
                : "Payments appear when a client funds a milestone on your contract."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">
                    {item.milestoneTitle ?? item.description ?? "Milestone payment"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.contractTitle ?? "Contract"}
                    {" · "}
                    {role === "hirer"
                      ? `To ${item.payeeName ?? "freelancer"}`
                      : `From ${item.payerName}`}
                    {" · "}
                    {formatRelativeJobDate(item.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-semibold">{formatPaymentAmount(item)}</p>
                  <Badge variant={payoutBadgeVariant(item.payoutStatus)}>
                    {getPayoutStatusLabel(item.payoutStatus)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {item.contractId ? (
                  role === "hirer" ? (
                    <Link
                      to="/dashboard/hirer/contracts/$contractId"
                      params={{ contractId: item.contractId }}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      View contract
                    </Link>
                  ) : (
                    <Link
                      to="/dashboard/freelancer/contracts/$contractId"
                      params={{ contractId: item.contractId }}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      View contract
                    </Link>
                  )
                ) : null}
                {role === "freelancer" && item.payoutStatus === "awaiting_payout" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending || !connect?.account?.readyForPayouts}
                    onClick={() => transferOne(item.id)}
                  >
                    Transfer payout
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
