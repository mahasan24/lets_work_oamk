import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lets_work/ui/components/dialog";
import { Label } from "@lets_work/ui/components/label";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Textarea } from "@lets_work/ui/components/textarea";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ContractsApiError,
  contractsApi,
  formatContractRate,
  getContractStatusLabel,
  type Contract,
} from "@/lib/contracts-api";
import { formatRelativeJobDate } from "@/lib/job-utils";

import { ContractMilestones } from "./contract-milestones";
import { ContractTimeline } from "./contract-timeline";

type ContractDetailProps = {
  contractId: string;
  role: "hirer" | "freelancer";
  listPath: "/dashboard/hirer/contracts" | "/dashboard/freelancer/contracts";
};

function StatusBadge({ status }: { status: Contract["status"] }) {
  const variant =
    status === "active"
      ? "default"
      : status === "cancelled" || status === "disputed"
        ? "destructive"
        : status === "paused"
          ? "secondary"
          : "secondary";
  return <Badge variant={variant}>{getContractStatusLabel(status)}</Badge>;
}

export function ContractDetail({ contractId, role, listPath }: ContractDetailProps) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setContract(await contractsApi.get(contractId));
    } catch {
      toast.error("Failed to load contract");
      setContract(null);
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = (
    action: () => Promise<Contract>,
    success: string,
    failure: string,
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      try {
        const updated = await action();
        setContract(updated);
        setTimelineRefreshKey((value) => value + 1);
        onSuccess?.();
        toast.success(success);
      } catch (error) {
        toast.error(error instanceof ContractsApiError ? error.message : failure);
      }
    });
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!contract) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">Contract not found</p>
          <Link to={listPath} className={cn(buttonVariants({ variant: "link" }), "mt-2 px-0")}>
            Back to contracts
          </Link>
        </CardContent>
      </Card>
    );
  }

  const counterpart = role === "hirer" ? contract.freelancer : contract.hirer;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to={listPath}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to contracts
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{contract.title}</h1>
          <StatusBadge status={contract.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {contract.contractType === "hourly" ? "Hourly contract" : "Fixed-price contract"} ·{" "}
          {formatContractRate(contract)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {contract.status === "active" ? (
          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(
                () => contractsApi.complete(contract.id),
                "Contract marked complete",
                "Failed to complete contract",
              )
            }
          >
            {isPending ? "Updating…" : "Mark complete"}
          </Button>
        ) : null}
        {role === "hirer" && contract.status === "active" ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              runAction(
                () => contractsApi.pause(contract.id),
                "Contract paused",
                "Failed to pause contract",
              )
            }
          >
            Pause
          </Button>
        ) : null}
        {role === "hirer" && contract.status === "paused" ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              runAction(
                () => contractsApi.resume(contract.id),
                "Contract resumed",
                "Failed to resume contract",
              )
            }
          >
            Resume
          </Button>
        ) : null}
        {(contract.status === "active" || contract.status === "paused") ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setShowDisputeDialog(true)}
          >
            Open dispute
          </Button>
        ) : null}
        {role === "hirer" &&
        (contract.status === "active" ||
          contract.status === "draft" ||
          contract.status === "paused") ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              runAction(
                () => contractsApi.cancel(contract.id),
                "Contract cancelled",
                "Failed to cancel contract",
              )
            }
          >
            Cancel contract
          </Button>
        ) : null}
        {role === "hirer" && contract.jobId ? (
          <Link
            to="/dashboard/hirer/jobs/$jobId"
            params={{ jobId: contract.jobId }}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            View job
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {role === "hirer" ? "Freelancer" : "Client"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage src={counterpart.image ?? undefined} />
              <AvatarFallback>{counterpart.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{counterpart.name}</p>
              <p className="text-sm text-muted-foreground">
                {role === "hirer" ? "Hired freelancer" : "Hiring client"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Detail label="Rate" value={formatContractRate(contract)} />
            <Detail
              label="Started"
              value={
                contract.startedAt
                  ? formatRelativeJobDate(contract.startedAt)
                  : "Not started"
              }
            />
            <Detail
              label="Ended"
              value={contract.endedAt ? formatRelativeJobDate(contract.endedAt) : "—"}
            />
            <Detail label="Created" value={formatRelativeJobDate(contract.createdAt)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope of work</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {contract.scope}
          </p>
        </CardContent>
      </Card>

      <ContractMilestones
        contract={contract}
        role={role}
        onChanged={() => {
          void load();
          setTimelineRefreshKey((value) => value + 1);
        }}
      />

      <ContractTimeline contractId={contract.id} refreshKey={timelineRefreshKey} />

      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open a dispute</DialogTitle>
            <DialogDescription>
              Explain the issue. Work will be paused while the contract is under dispute.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason</Label>
            <Textarea
              id="dispute-reason"
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              placeholder="Describe what went wrong and what resolution you need."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !disputeReason.trim()}
              onClick={() =>
                runAction(
                  () => contractsApi.dispute(contract.id, { reason: disputeReason }),
                  "Dispute opened",
                  "Failed to open dispute",
                  () => {
                    setShowDisputeDialog(false);
                    setDisputeReason("");
                  },
                )
              }
            >
              Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
