import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lets_work/ui/components/dialog";
import { Input } from "@lets_work/ui/components/input";
import { Label } from "@lets_work/ui/components/label";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Textarea } from "@lets_work/ui/components/textarea";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Contract } from "@/lib/contracts-api";
import { formatRelativeJobDate } from "@/lib/job-utils";
import {
  formatMilestoneAmount,
  getMilestoneStatusLabel,
  MilestonesApiError,
  milestonesApi,
  type Milestone,
  type MilestoneListResponse,
} from "@/lib/milestones-api";

type ContractMilestonesProps = {
  contract: Contract;
  role: "hirer" | "freelancer";
  onChanged?: () => void;
};

type DialogMode = "create" | "submit" | "revision" | null;

function statusVariant(status: Milestone["status"]) {
  switch (status) {
    case "approved":
    case "released":
      return "default" as const;
    case "submitted":
      return "secondary" as const;
    case "revision_requested":
    case "disputed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function ContractMilestones({ contract, role, onChanged }: ContractMilestonesProps) {
  const [data, setData] = useState<MilestoneListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<Milestone | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await milestonesApi.list(contract.id));
    } catch {
      toast.error("Failed to load milestones");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [contract.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = (
    action: () => Promise<unknown>,
    success: string,
    failure: string,
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      try {
        await action();
        await load();
        onChanged?.();
        onSuccess?.();
        toast.success(success);
      } catch (error) {
        toast.error(error instanceof MilestonesApiError ? error.message : failure);
      }
    });
  };

  const openCreate = () => {
    setTitle("");
    setAmount("");
    setDescription("");
    setDueDate("");
    setDialogMode("create");
  };

  const openSubmit = (milestone: Milestone) => {
    setSelected(milestone);
    setNote("");
    setDialogMode("submit");
  };

  const openRevision = (milestone: Milestone) => {
    setSelected(milestone);
    setNote("");
    setDialogMode("revision");
  };

  if (contract.contractType === "hourly") {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const items = data?.items ?? [];
  const completionPercent = data?.meta.completionPercent ?? 0;
  const isActive = contract.status === "active";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="text-base">Milestones</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track deliverables, submissions, and approvals for this fixed-price contract.
          </p>
          {items.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{completionPercent}% complete</span>
                <span>
                  {data?.meta.approved ?? 0} of {items.length} approved
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        {role === "hirer" && isActive ? (
          <Button type="button" size="sm" onClick={openCreate}>
            Add milestone
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No milestones yet.{" "}
            {role === "hirer"
              ? "Add milestones to break the project into deliverables."
              : "Your client has not added milestones yet."}
          </p>
        ) : (
          items.map((milestone) => (
            <div
              key={milestone.id}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{milestone.title}</p>
                    <Badge variant={statusVariant(milestone.status)}>
                      {getMilestoneStatusLabel(milestone.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatMilestoneAmount(milestone)}
                    {milestone.dueDate
                      ? ` · Due ${formatRelativeJobDate(milestone.dueDate)}`
                      : ""}
                  </p>
                  {milestone.description ? (
                    <p className="text-sm text-muted-foreground">{milestone.description}</p>
                  ) : null}
                  {milestone.revisionNote ? (
                    <p className="text-sm text-destructive">
                      Revision feedback: {milestone.revisionNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {role === "freelancer" && isActive && milestone.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        runAction(
                          () => milestonesApi.start(milestone.id),
                          "Milestone started",
                          "Failed to start milestone",
                        )
                      }
                    >
                      Start
                    </Button>
                  ) : null}
                  {role === "freelancer" &&
                  isActive &&
                  (milestone.status === "in_progress" || milestone.status === "revision_requested") ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => openSubmit(milestone)}
                    >
                      Submit
                    </Button>
                  ) : null}
                  {role === "hirer" && isActive && milestone.status === "submitted" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          runAction(
                            () => milestonesApi.approve(milestone.id),
                            "Milestone approved",
                            "Failed to approve milestone",
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => openRevision(milestone)}
                      >
                        Request revision
                      </Button>
                    </>
                  ) : null}
                  {role === "hirer" && isActive && milestone.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        runAction(
                          () => milestonesApi.delete(milestone.id),
                          "Milestone deleted",
                          "Failed to delete milestone",
                        )
                      }
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
              {milestone.submissions.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Submissions</p>
                  {milestone.submissions.slice(0, 3).map((submission) => (
                    <div key={submission.id} className="rounded-md bg-muted/40 p-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeJobDate(submission.createdAt)}
                      </p>
                      {submission.note ? <p className="mt-1">{submission.note}</p> : null}
                      {submission.attachmentUrl ? (
                        <a
                          href={submission.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
                        >
                          View attachment
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setSelected(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {dialogMode === "create" ? (
            <>
              <DialogHeader>
                <DialogTitle>Add milestone</DialogTitle>
                <DialogDescription>
                  Split the contract into a deliverable with an amount and optional due date.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="milestone-title">Title</Label>
                  <Input
                    id="milestone-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Homepage redesign"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="milestone-amount">Amount</Label>
                  <Input
                    id="milestone-amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="milestone-description">Description</Label>
                  <Textarea
                    id="milestone-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What should be delivered in this milestone?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="milestone-due-date">Due date</Label>
                  <Input
                    id="milestone-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={isPending || !title.trim() || !amount.trim()}
                  onClick={() =>
                    runAction(
                      () =>
                        milestonesApi.create(contract.id, {
                          title,
                          amount,
                          description: description || undefined,
                          dueDate: dueDate || undefined,
                        }),
                      "Milestone created",
                      "Failed to create milestone",
                      () => setDialogMode(null),
                    )
                  }
                >
                  Create milestone
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogMode === "submit" && selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Submit {selected.title}</DialogTitle>
                <DialogDescription>
                  Share delivery notes or a link to the completed work.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="submission-note">Delivery note</Label>
                <Textarea
                  id="submission-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Describe what you delivered or paste a link."
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(
                      () =>
                        milestonesApi.submit(selected.id, {
                          note: note || undefined,
                        }),
                      "Milestone submitted",
                      "Failed to submit milestone",
                      () => setDialogMode(null),
                    )
                  }
                >
                  Submit milestone
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogMode === "revision" && selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Request revision</DialogTitle>
                <DialogDescription>
                  Tell the freelancer what needs to change before you approve{" "}
                  {selected.title}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="revision-note">Revision feedback</Label>
                <Textarea
                  id="revision-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Please update the mobile layout and resubmit."
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={isPending || !note.trim()}
                  onClick={() =>
                    runAction(
                      () =>
                        milestonesApi.requestRevision(selected.id, {
                          note,
                        }),
                      "Revision requested",
                      "Failed to request revision",
                      () => setDialogMode(null),
                    )
                  }
                >
                  Send feedback
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
