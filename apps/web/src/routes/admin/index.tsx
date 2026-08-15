import { Badge } from "@lets_work/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { adminApi, type AdminOverview } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      {description ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getOverview()
      .then((overview) => {
        if (!cancelled) setData(overview);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load overview metrics");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="text-sm text-muted-foreground">
          Live platform counts for users, marketplace activity, escrow, and open queues.
        </p>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading metrics…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Users"
              value={data.users.total}
              description={`+${data.users.last7Days} in 7 days · +${data.users.last30Days} in 30 days`}
            />
            <MetricCard
              title="Open jobs"
              value={data.jobs.open}
              description={`${data.jobs.total} jobs total · ${data.proposals.total} proposals`}
            />
            <MetricCard
              title="Active contracts"
              value={data.contracts.active}
              description={`${data.contracts.disputed} disputed · ${data.contracts.total} total`}
            />
            <MetricCard
              title="Escrow held"
              value={formatMoney(data.payments.escrowHeldUsd)}
              description={`${formatMoney(data.payments.volumeUsd)} volume (held + succeeded)`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Freelancers" value={data.users.freelancers} />
            <MetricCard title="Hirers" value={data.users.hirers} />
            <MetricCard title="Suspended" value={data.users.suspended} />
            <MetricCard
              title="Payments succeeded"
              value={data.payments.succeededCount}
              description={`${data.payments.heldCount} currently held`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Open queues</CardTitle>
                <CardDescription>Work waiting on admin action</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link
                  to="/admin/verifications"
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span>Identity verifications</span>
                  <Badge variant={data.verifications.pending > 0 ? "destructive" : "secondary"}>
                    {data.verifications.pending}
                  </Badge>
                </Link>
                <Link
                  to="/admin/disputes"
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span>Open disputes</span>
                  <Badge variant={data.disputes.open > 0 ? "destructive" : "secondary"}>
                    {data.disputes.open}
                  </Badge>
                </Link>
                <Link
                  to="/admin/reports"
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span>Content reports</span>
                  <Badge variant={data.reports.open > 0 ? "destructive" : "secondary"}>
                    {data.reports.open}
                  </Badge>
                </Link>
                <Link
                  to="/admin/users"
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span>User search & suspend</span>
                  <Badge variant="outline">Manage</Badge>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Snapshot</CardTitle>
                <CardDescription>
                  Generated {new Date(data.generatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Metrics are computed live from the database (no event pipeline). Use the queues on
                the left to clear pending trust and mediation work.
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
