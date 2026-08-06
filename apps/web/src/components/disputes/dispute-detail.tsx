import { Badge } from "@lets_work/ui/components/badge";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DisputesApiError,
  disputesApi,
  getDisputeStatusLabel,
  type DisputeDetail,
} from "@/lib/disputes-api";
import { formatRelativeJobDate } from "@/lib/job-utils";

type DisputeDetailViewProps = {
  disputeId: string;
  role: "hirer" | "freelancer";
};

export function DisputeDetailView({ disputeId, role }: DisputeDetailViewProps) {
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const listPath =
    role === "hirer" ? "/dashboard/hirer/disputes" : "/dashboard/freelancer/disputes";

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setDispute(await disputesApi.get(disputeId));
    } catch (error) {
      toast.error(error instanceof DisputesApiError ? error.message : "Failed to load dispute");
      setDispute(null);
    } finally {
      setIsLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (!dispute) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">Dispute not found</p>
          <Link to={listPath} className={cn(buttonVariants({ variant: "link" }), "mt-2 px-0")}>
            Back to disputes
          </Link>
        </CardContent>
      </Card>
    );
  }

  const contractPath =
    dispute.contractPathRole === "hirer"
      ? "/dashboard/hirer/contracts/$contractId"
      : "/dashboard/freelancer/contracts/$contractId";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to={listPath} className="text-sm text-muted-foreground hover:text-foreground w-fit">
          ← Back to disputes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{dispute.reason}</h1>
            <p className="text-sm text-muted-foreground">
              {dispute.contractTitle}
              {dispute.milestoneTitle ? ` · ${dispute.milestoneTitle}` : ""}
              {" · "}
              {formatRelativeJobDate(dispute.createdAt)}
            </p>
          </div>
          <Badge variant={dispute.status === "open" ? "destructive" : "secondary"}>
            {getDisputeStatusLabel(dispute.status)}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{dispute.description}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Opened by:</span> {dispute.openedByName}
            </p>
            <p>
              <span className="text-muted-foreground">Respondent:</span> {dispute.respondentName}
            </p>
            <p>
              <span className="text-muted-foreground">Your role:</span>{" "}
              {dispute.direction === "opened"
                ? "You opened this dispute"
                : "You are the respondent"}
            </p>
            {dispute.resolution ? (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Resolution:</span> {dispute.resolution}
              </p>
            ) : (
              <p className="sm:col-span-2 text-muted-foreground">
                No admin resolution yet. Use chat on the contract to discuss with the other party.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <Link
          to={contractPath}
          params={{ contractId: dispute.contractId }}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          View contract
        </Link>
      </div>
    </div>
  );
}
