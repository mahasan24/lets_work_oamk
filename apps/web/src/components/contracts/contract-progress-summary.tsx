import { Badge } from "@lets_work/ui/components/badge";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { contractsApi, type ContractProgressSummary } from "@/lib/contracts-api";
import { formatRelativeJobDate } from "@/lib/job-utils";

type ContractProgressSummaryCardProps = {
  role: "hirer" | "freelancer";
};

export function ContractProgressSummaryCard({ role }: ContractProgressSummaryCardProps) {
  const [summary, setSummary] = useState<ContractProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(await contractsApi.progressSummary({ role }));
    } catch {
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const contractsPath =
    role === "hirer" ? "/dashboard/hirer/contracts" : "/dashboard/freelancer/contracts";
  const contractDetailPath =
    role === "hirer"
      ? "/dashboard/hirer/contracts/$contractId"
      : "/dashboard/freelancer/contracts/$contractId";

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!summary || summary.meta.activeContracts + summary.meta.pausedContracts === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Contract progress</CardTitle>
          <p className="text-sm text-muted-foreground">
            {summary.meta.activeContracts} active · {summary.meta.overallCompletionPercent}%
            milestones approved
          </p>
        </div>
        <Link to={contractsPath} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          View contracts
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.meta.overdueCount > 0 ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-medium">Overdue milestones</p>
              <Badge variant="destructive">{summary.meta.overdueCount}</Badge>
            </div>
            <div className="space-y-2">
              {summary.overdueMilestones.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">{item.contract.title}</p>
                  </div>
                  <Link
                    to={contractDetailPath}
                    params={{ contractId: item.contract.id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {summary.contracts.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Active contracts</p>
            {summary.contracts.slice(0, 4).map((contract) => (
              <div key={contract.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{contract.title}</p>
                    {contract.jobTitle ? (
                      <p className="text-xs text-muted-foreground">{contract.jobTitle}</p>
                    ) : null}
                  </div>
                  <Badge variant={contract.status === "paused" ? "secondary" : "outline"}>
                    {contract.completionPercent}%
                  </Badge>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${contract.completionPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {contract.milestoneApproved} of {contract.milestoneTotal} milestones approved
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {summary.upcomingMilestones.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Upcoming deadlines</p>
            {summary.upcomingMilestones.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground">{item.contract.title}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.dueDate ? formatRelativeJobDate(item.dueDate) : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
