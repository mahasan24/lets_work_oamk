import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  disputesApi,
  getDisputeStatusLabel,
  type DisputeListItem,
  type DisputeStatus,
} from "@/lib/disputes-api";
import { formatRelativeJobDate } from "@/lib/job-utils";

type DisputesListProps = {
  role: "hirer" | "freelancer";
};

const STATUS_FILTERS: Array<{ value: "all" | DisputeStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "resolved_client", label: "Resolved (client)" },
  { value: "resolved_freelancer", label: "Resolved (freelancer)" },
  { value: "closed", label: "Closed" },
];

export function DisputesList({ role }: DisputesListProps) {
  const [items, setItems] = useState<DisputeListItem[]>([]);
  const [status, setStatus] = useState<"all" | DisputeStatus>("all");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await disputesApi.list({
        status: status === "all" ? undefined : status,
        limit: 50,
      });
      setItems(response.items);
    } catch {
      toast.error("Failed to load disputes");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const detailTo =
    role === "hirer"
      ? "/dashboard/hirer/disputes/$disputeId"
      : "/dashboard/freelancer/disputes/$disputeId";
  const contractsTo =
    role === "hirer" ? "/dashboard/hirer/contracts" : "/dashboard/freelancer/contracts";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Disputes</h1>
        <p className="text-sm text-muted-foreground">
          Issues raised on your contracts. Work and milestone approvals pause while a dispute is
          open. Admin mediation comes in a later release.
        </p>
        <Link
          to={contractsTo}
          className="text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          ← Back to contracts
        </Link>
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
            <p className="font-medium">No disputes</p>
            <p className="text-sm text-muted-foreground">
              Open a dispute from an active or paused contract if something goes wrong.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">{item.reason}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.contractTitle}
                    {item.milestoneTitle ? ` · ${item.milestoneTitle}` : ""}
                    {" · "}
                    {formatRelativeJobDate(item.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.direction === "opened"
                      ? `You opened · respondent ${item.respondentName}`
                      : `Opened by ${item.openedByName}`}
                  </p>
                </div>
                <Badge variant={item.status === "open" ? "destructive" : "secondary"}>
                  {getDisputeStatusLabel(item.status)}
                </Badge>
              </CardHeader>
              <CardContent>
                <Link
                  to={detailTo}
                  params={{ disputeId: item.id }}
                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  View details
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
