import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  contractsApi,
  formatContractRate,
  getContractStatusLabel,
  type Contract,
  type ContractStatus,
} from "@/lib/contracts-api";
import { formatRelativeJobDate } from "@/lib/job-utils";

type ContractsListProps = {
  role: "hirer" | "freelancer";
  detailBasePath: "/dashboard/hirer/contracts" | "/dashboard/freelancer/contracts";
};

const STATUS_FILTERS: Array<{ value: "all" | ContractStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "disputed", label: "Disputed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusBadge({ status }: { status: ContractStatus }) {
  const variant =
    status === "active"
      ? "default"
      : status === "cancelled" || status === "disputed"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{getContractStatusLabel(status)}</Badge>;
}

export function ContractsList({ role, detailBasePath }: ContractsListProps) {
  const [items, setItems] = useState<Contract[]>([]);
  const [status, setStatus] = useState<"all" | ContractStatus>("all");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await contractsApi.list({
        role,
        status: status === "all" ? undefined : status,
      });
      setItems(response.items);
    } catch {
      toast.error("Failed to load contracts");
    } finally {
      setIsLoading(false);
    }
  }, [role, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
        <p className="text-sm text-muted-foreground">
          {role === "hirer"
            ? "Contracts created when you hire freelancers from proposals."
            : "Contracts from jobs you've been hired for."}
        </p>
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
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No contracts yet</p>
            <p className="text-sm text-muted-foreground">
              {role === "hirer"
                ? "Hire a freelancer from a job's proposals page to create a contract."
                : "Contracts appear here after a client hires you."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const counterpart = role === "hirer" ? item.freelancer : item.hirer;
            return (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={counterpart.image ?? undefined} />
                      <AvatarFallback>
                        {counterpart.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{item.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {role === "hirer" ? "Freelancer" : "Client"}: {counterpart.name}
                      </p>
                      <p className="mt-1 text-sm font-medium">{formatContractRate(item)}</p>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Started{" "}
                    {item.startedAt
                      ? formatRelativeJobDate(item.startedAt)
                      : formatRelativeJobDate(item.createdAt)}
                  </p>
                  <Link
                    to={
                      role === "hirer"
                        ? "/dashboard/hirer/contracts/$contractId"
                        : "/dashboard/freelancer/contracts/$contractId"
                    }
                    params={{ contractId: item.id }}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    View contract
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
