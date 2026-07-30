import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@lets_work/ui/components/tabs";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { chatApi } from "@/lib/chat-api";
import {
  freelancerJobsApi,
  type FreelancerProposalListResponse,
  type FreelancerProposalSummary,
} from "@/lib/freelancer-jobs-api";
import { getDurationLabel } from "@/lib/job-options";
import { formatRelativeJobDate } from "@/lib/job-utils";
import { getProposalStatusLabel, proposalsApi, type ProposalStatus } from "@/lib/proposals-api";

type StatusFilter = ProposalStatus | "all";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Drafts" },
  { value: "withdrawn", label: "Withdrawn" },
];

function statusVariant(status: ProposalStatus) {
  switch (status) {
    case "accepted":
      return "default" as const;
    case "shortlisted":
      return "secondary" as const;
    case "rejected":
    case "withdrawn":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function MyProposals() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [data, setData] = useState<FreelancerProposalListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await freelancerJobsApi.listProposals({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
      });
      setData(response);
    } catch {
      toast.error("Failed to load your proposals");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const withdraw = useCallback(
    async (proposal: FreelancerProposalSummary) => {
      setWithdrawingId(proposal.id);
      try {
        await proposalsApi.withdraw(proposal.id);
        toast.success("Proposal withdrawn");
        await loadProposals();
      } catch {
        toast.error("Could not withdraw this proposal");
      } finally {
        setWithdrawingId(null);
      }
    },
    [loadProposals],
  );

  const openChat = useCallback(
    async (proposal: FreelancerProposalSummary) => {
      setMessagingId(proposal.id);
      try {
        const conversation = await chatApi.createOrGetConversation({
          participantUserId: proposal.hirerUserId,
          jobId: proposal.jobId,
        });
        await navigate({
          to: "/dashboard/freelancer/messages",
          search: { conversationId: conversation.id },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to open chat");
      } finally {
        setMessagingId(null);
      }
    },
    [navigate],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">My proposals</h1>
        <p className="text-sm text-muted-foreground">
          Track every job you have applied to and follow where each one stands.
        </p>
      </div>

      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
        <TabsList className="h-auto flex-wrap">
          {STATUS_FILTERS.map((option) => {
            const count = option.value === "all" ? undefined : data?.statusCounts[option.value];
            return (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
                {count ? ` (${count})` : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">
              {statusFilter === "all"
                ? "You have not applied to any jobs yet"
                : `No ${getProposalStatusLabel(statusFilter as ProposalStatus).toLowerCase()} proposals`}
            </p>
            <p className="text-sm text-muted-foreground">
              Browse open jobs matched to your skills and send your first proposal.
            </p>
            <Link
              to="/dashboard/freelancer"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Find work
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    {proposal.jobSlug ? (
                      <Link
                        to="/dashboard/freelancer/jobs/$slug"
                        params={{ slug: proposal.jobSlug }}
                        className="hover:underline"
                      >
                        <CardTitle className="text-base leading-snug font-semibold">
                          {proposal.jobTitle}
                        </CardTitle>
                      </Link>
                    ) : (
                      <CardTitle className="text-base leading-snug font-semibold">
                        {proposal.jobTitle}
                      </CardTitle>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {proposal.hirerDisplayName} ·{" "}
                      {proposal.submittedAt
                        ? `Applied ${formatRelativeJobDate(proposal.submittedAt)}`
                        : `Saved ${formatRelativeJobDate(proposal.updatedAt)}`}{" "}
                      · {proposal.jobProposalsCount} proposal
                      {proposal.jobProposalsCount === 1 ? "" : "s"} on this job
                    </p>
                  </div>
                  <Badge variant={statusVariant(proposal.status)} className="shrink-0">
                    {getProposalStatusLabel(proposal.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {proposal.proposedRate
                    ? `Your bid: ${proposal.jobCurrency === "USD" ? "$" : `${proposal.jobCurrency} `}${proposal.proposedRate}${
                        proposal.jobBudgetType === "hourly" ? "/hr" : ""
                      }`
                    : "No rate proposed"}
                  {proposal.estimatedDuration
                    ? ` · ${getDurationLabel(proposal.estimatedDuration)}`
                    : ""}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{proposal.coverLetter}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {proposal.jobSlug ? (
                    <Link
                      to="/dashboard/freelancer/jobs/$slug"
                      params={{ slug: proposal.jobSlug }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {proposal.status === "draft" ? "Finish proposal" : "View job"}
                    </Link>
                  ) : null}
                  {proposal.status === "shortlisted" || proposal.status === "accepted" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messagingId === proposal.id}
                      onClick={() => void openChat(proposal)}
                    >
                      {messagingId === proposal.id ? "Opening…" : "Open chat"}
                    </Button>
                  ) : null}
                  {proposal.status === "submitted" || proposal.status === "shortlisted" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={withdrawingId === proposal.id}
                      onClick={() => withdraw(proposal)}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
