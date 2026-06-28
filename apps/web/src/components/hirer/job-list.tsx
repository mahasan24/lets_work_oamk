import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Input } from "@lets_work/ui/components/input";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@lets_work/ui/components/tabs";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { JobsApiError, jobsApi, type Job } from "@/lib/jobs-api";
import { JOB_STATUS_OPTIONS, type JobStatus } from "@/lib/job-options";
import { formatBudgetRange, formatRelativeJobDate } from "@/lib/job-utils";

import { JobActionsMenu } from "./job-actions-menu";
import { JobStatusBadge } from "./job-status-badge";

type StatusFilter = JobStatus | "all";

type JobListProps = {
  showHeader?: boolean;
};

export function JobList({ showHeader = true }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await jobsApi.listMine({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
        limit: 50,
      });
      setJobs(response.items);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleJobUpdated = (updated: Job) => {
    setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleJobDeleted = (jobId: string) => {
    setJobs((current) => current.filter((item) => item.id !== jobId));
  };

  return (
    <div className="flex flex-col gap-4">
      {showHeader ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Your job posts</h2>
          <Link to="/dashboard/hirer/jobs/new" className={cn(buttonVariants(), "shrink-0")}>
            Post a job
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {JOB_STATUS_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search jobs..."
          className="h-10 max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div className="flex flex-col gap-1">
              <p className="font-medium">No jobs yet</p>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || statusFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Create your first job post to start receiving proposals."}
              </p>
            </div>
            {!debouncedSearch && statusFilter === "all" ? (
              <Link to="/dashboard/hirer/jobs/new" className={buttonVariants()}>
                Post a job
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {job.status === "draft"
                          ? `Last edited ${formatRelativeJobDate(job.updatedAt)}`
                          : formatRelativeJobDate(job.publishedAt ?? job.createdAt)}
                      </span>
                      <span>·</span>
                      <span>
                        {job.proposalsCount} proposal{job.proposalsCount === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>{formatBudgetRange(job)}</span>
                    </div>
                    <Link
                      to="/dashboard/hirer/jobs/$jobId"
                      params={{ jobId: job.id }}
                      className="hover:underline"
                    >
                      <CardTitle className="text-base leading-snug font-semibold">
                        {job.title}
                      </CardTitle>
                    </Link>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{job.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <JobStatusBadge status={job.status} />
                    <JobActionsMenu
                      job={job}
                      onUpdated={handleJobUpdated}
                      onDeleted={() => handleJobDeleted(job.id)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/dashboard/hirer/jobs/$jobId"
                    params={{ jobId: job.id }}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {job.status === "closed" ? "View" : "Edit"}
                  </Link>
                  {job.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const updated = await jobsApi.publish(job.id);
                          handleJobUpdated(updated);
                          toast.success("Job published");
                        } catch (error) {
                          if (error instanceof JobsApiError && error.errors?.length) {
                            toast.error(error.errors[0]);
                          } else {
                            toast.error(
                              error instanceof Error ? error.message : "Failed to publish",
                            );
                          }
                        }
                      }}
                    >
                      Publish
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
