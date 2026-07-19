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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@lets_work/ui/components/select";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@lets_work/ui/components/tabs";
import { Textarea } from "@lets_work/ui/components/textarea";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { getDurationLabel } from "@/lib/job-options";
import { formatRelativeJobDate } from "@/lib/job-utils";
import {
  getProposalStatusLabel,
  hirerProposalsApi,
  ProposalsApiError,
  PROPOSAL_SORT_OPTIONS,
  PROPOSAL_STATUS_FILTER_OPTIONS,
  type HirerHireResponse,
  type HirerProposal,
  type HirerProposalListResponse,
  type ProposalStatus,
} from "@/lib/proposals-api";
import { getCountryLabel } from "@/lib/profile-options";

type StatusFilter = ProposalStatus | "all";
type SortOption = "newest" | "rate_low" | "rate_high";
type DialogMode = "message" | "hire" | null;

type JobProposalsDashboardProps = {
  jobId: string;
};

function formatProposedRate(proposal: HirerProposal) {
  const symbol = proposal.job.currency === "USD" ? "$" : proposal.job.currency;
  if (!proposal.proposedRate) return "Not specified";

  return proposal.job.budgetType === "hourly"
    ? `${symbol}${proposal.proposedRate}/hr`
    : `${symbol}${proposal.proposedRate}`;
}

function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const variant =
    status === "accepted"
      ? "default"
      : status === "shortlisted"
        ? "default"
        : status === "rejected" || status === "withdrawn"
          ? "destructive"
          : "secondary";

  return <Badge variant={variant}>{getProposalStatusLabel(status)}</Badge>;
}

function actionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ProposalsApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function JobProposalsDashboard({ jobId }: JobProposalsDashboardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<HirerProposalListResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [messageBody, setMessageBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await hirerProposalsApi.listForJob(jobId, {
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as Exclude<ProposalStatus, "draft">),
        sort,
      });
      setData(response);
      setSelectedId((current) => {
        if (current && response.items.some((item) => item.id === current)) return current;
        return response.items[0]?.id ?? null;
      });
      setCompareId((current) => {
        if (current && response.items.some((item) => item.id === current)) return current;
        return null;
      });
    } catch {
      toast.error("Failed to load proposals");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, sort, statusFilter]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const selected = data?.items.find((item) => item.id === selectedId) ?? null;
  const compare = data?.items.find((item) => item.id === compareId) ?? null;
  const jobIsOpen =
    data?.job.status === "open" ||
    data?.job.status === "in_review" ||
    data?.job.status === "paused";

  const toggleCompare = (id: string) => {
    if (compareId === id) {
      setCompareId(null);
      return;
    }
    if (selectedId === id) return;
    setCompareId(id);
  };

  const runAction = (
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ) => {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        setDialogMode(null);
        setMessageBody("");
        await loadProposals();
      } catch (error) {
        toast.error(actionErrorMessage(error, failureMessage));
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            to="/dashboard/hirer/jobs/$jobId"
            params={{ jobId }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to job
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data?.job.title ?? "Proposals"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.meta.total} proposal${data.meta.total === 1 ? "" : "s"} to review`
              : "Review, shortlist, message, and hire freelancers"}
          </p>
        </div>
        <Link
          to="/dashboard/hirer/jobs/$jobId"
          params={{ jobId }}
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          Edit job
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <TabsList className="h-auto flex-wrap">
            {PROPOSAL_STATUS_FILTER_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
                {data && option.value !== "all" && data.meta.statusCounts[option.value]
                  ? ` (${data.meta.statusCounts[option.value]})`
                  : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
          <SelectTrigger className="h-10 w-full sm:w-44">
            {PROPOSAL_SORT_OPTIONS.find((option) => option.value === sort)?.label}
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PROPOSAL_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No proposals yet</p>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== "all"
                ? "Try a different status filter."
                : "Freelancers will appear here once they submit proposals to this job."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {data.items.map((item) => {
              const isSelected = item.id === selectedId;
              const isCompare = item.id === compareId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={item.freelancer.image ?? undefined} />
                      <AvatarFallback>
                        {item.freelancer.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium">{item.freelancer.name}</p>
                        <ProposalStatusBadge status={item.status} />
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {item.freelancer.headline ?? "Freelancer"}
                      </p>
                      <p className="mt-1 text-sm font-medium">{formatProposedRate(item)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.submittedAt
                          ? formatRelativeJobDate(item.submittedAt)
                          : "Not submitted"}
                      </p>
                    </div>
                  </div>
                  {!isSelected ? (
                    <Button
                      type="button"
                      variant={isCompare ? "default" : "outline"}
                      size="sm"
                      className="mt-3 w-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCompare(item.id);
                      }}
                    >
                      {isCompare ? "Comparing" : "Compare"}
                    </Button>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {selected ? (
              <ProposalDetailCard
                proposal={selected}
                jobIsOpen={jobIsOpen}
                isPending={isPending}
                onShortlist={() =>
                  runAction(
                    () => hirerProposalsApi.shortlist(selected.id),
                    "Proposal shortlisted",
                    "Failed to shortlist proposal",
                  )
                }
                onUnshortlist={() =>
                  runAction(
                    () => hirerProposalsApi.unshortlist(selected.id),
                    "Removed from shortlist",
                    "Failed to update proposal",
                  )
                }
                onReject={() =>
                  runAction(
                    () => hirerProposalsApi.reject(selected.id),
                    "Proposal archived",
                    "Failed to archive proposal",
                  )
                }
                onMessage={() => setDialogMode("message")}
                onHire={() => setDialogMode("hire")}
              />
            ) : null}
            {compare ? <ProposalDetailCard proposal={compare} title="Compare" /> : null}
          </div>
        </div>
      )}

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setMessageBody("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {dialogMode === "message" && selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Message {selected.freelancer.name}</DialogTitle>
                <DialogDescription>
                  Send a note about this shortlisted proposal. The freelancer will be notified.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Thanks for applying — I'd like to discuss timeline and availability."
                rows={5}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setDialogMode(null);
                    setMessageBody("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isPending || messageBody.trim().length === 0}
                  onClick={() =>
                    runAction(
                      () => hirerProposalsApi.message(selected.id, messageBody),
                      "Message sent",
                      "Failed to send message",
                    )
                  }
                >
                  {isPending ? "Sending…" : "Send message"}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialogMode === "hire" && selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Hire {selected.freelancer.name}?</DialogTitle>
                <DialogDescription>
                  This accepts their proposal, creates an active contract, marks the job as
                  filled, and archives other active proposals.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{formatProposedRate(selected)}</p>
                <p className="text-muted-foreground">
                  Timeline: {getDurationLabel(selected.estimatedDuration)}
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setDialogMode(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const result = (await hirerProposalsApi.accept(
                          selected.id,
                        )) as HirerHireResponse;
                        toast.success("Freelancer hired — contract created");
                        setDialogMode(null);
                        await navigate({
                          to: "/dashboard/hirer/contracts/$contractId",
                          params: { contractId: result.contract.id },
                        });
                      } catch (error) {
                        toast.error(
                          actionErrorMessage(error, "Failed to hire freelancer"),
                        );
                      }
                    });
                  }}
                >
                  {isPending ? "Hiring…" : "Confirm hire"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProposalDetailCard({
  proposal,
  title = "Proposal details",
  jobIsOpen = false,
  isPending = false,
  onShortlist,
  onUnshortlist,
  onReject,
  onMessage,
  onHire,
}: {
  proposal: HirerProposal;
  title?: string;
  jobIsOpen?: boolean;
  isPending?: boolean;
  onShortlist?: () => void;
  onUnshortlist?: () => void;
  onReject?: () => void;
  onMessage?: () => void;
  onHire?: () => void;
}) {
  const countryLabel = getCountryLabel(proposal.freelancer.country);
  const location = [proposal.freelancer.city, countryLabel].filter(Boolean).join(", ");
  const canShortlist = proposal.status === "submitted" && jobIsOpen;
  const canUnshortlist = proposal.status === "shortlisted" && jobIsOpen;
  const canReject =
    (proposal.status === "submitted" || proposal.status === "shortlisted") && jobIsOpen;
  const canMessage =
    proposal.status === "shortlisted" || proposal.status === "accepted";
  const canHire =
    (proposal.status === "submitted" || proposal.status === "shortlisted") && jobIsOpen;
  const showActions = onShortlist || onUnshortlist || onReject || onMessage || onHire;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            <AvatarImage src={proposal.freelancer.image ?? undefined} />
            <AvatarFallback>{proposal.freelancer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              <ProposalStatusBadge status={proposal.status} />
            </div>
            <p className="font-medium">{proposal.freelancer.name}</p>
            <p className="text-sm text-muted-foreground">
              {proposal.freelancer.headline ?? "Freelancer"}
              {location ? ` · ${location}` : ""}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {showActions ? (
          <div className="flex flex-wrap gap-2">
            {canShortlist ? (
              <Button type="button" size="sm" disabled={isPending} onClick={onShortlist}>
                Shortlist
              </Button>
            ) : null}
            {canUnshortlist ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={onUnshortlist}
              >
                Remove shortlist
              </Button>
            ) : null}
            {canMessage ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={onMessage}
              >
                Message
              </Button>
            ) : null}
            {canHire ? (
              <Button type="button" size="sm" disabled={isPending} onClick={onHire}>
                Hire
              </Button>
            ) : null}
            {canReject ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={onReject}
              >
                Archive
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <DetailItem label="Bid" value={formatProposedRate(proposal)} />
          <DetailItem
            label="Timeline"
            value={getDurationLabel(proposal.estimatedDuration)}
          />
          <DetailItem
            label="Submitted"
            value={
              proposal.submittedAt
                ? formatRelativeJobDate(proposal.submittedAt)
                : "Not submitted"
            }
          />
          <DetailItem
            label="Profile"
            value={`${proposal.freelancer.profileCompletion}% complete`}
          />
          <DetailItem
            label="Jobs completed"
            value={String(proposal.freelancer.jobsCompleted)}
          />
          <DetailItem
            label="Rating"
            value={
              proposal.freelancer.avgRating
                ? `${proposal.freelancer.avgRating} (${proposal.freelancer.reviewCount})`
                : "No reviews yet"
            }
          />
        </div>

        {proposal.freelancer.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {proposal.freelancer.skills.map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Cover letter</p>
          <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            {proposal.coverLetter}
          </p>
        </div>

        {proposal.attachments.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Attachments</p>
            <ul className="flex flex-col gap-2">
              {proposal.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{attachment.fileName}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
