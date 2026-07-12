import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Separator } from "@lets_work/ui/components/separator";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ProposalForm } from "@/components/freelancer/proposal-form";
import {
  getDurationLabel,
  getExperienceLevelLabel,
  getBudgetTypeLabel,
} from "@/lib/job-options";
import { formatBudgetRange, formatJobMetaLine, formatRelativeJobDate } from "@/lib/job-utils";
import { jobsApi, type PublicJob } from "@/lib/jobs-api";
import { getCountryLabel } from "@/lib/profile-options";

export const Route = createFileRoute("/dashboard/freelancer/jobs/$slug")({
  component: FreelancerJobDetailPage,
});

function FreelancerJobDetailPage() {
  const { slug } = Route.useParams();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadJob = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await jobsApi.getPublic(slug);
      setJob(loaded);
    } catch {
      toast.error("Job not found");
      setJob(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading job...</p>;
  }

  if (!job) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <p className="font-medium">Job not found</p>
          <Link to="/dashboard/freelancer" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to jobs
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          to="/dashboard/freelancer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to jobs
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{job.category}</Badge>
          {job.remoteOnly ? <Badge variant="outline">Remote</Badge> : null}
          <span className="text-xs text-muted-foreground">
            Posted {formatRelativeJobDate(job.publishedAt ?? job.createdAt)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="text-sm text-muted-foreground">{formatJobMetaLine(job)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About the client</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{job.hirer.displayName}</p>
          {job.hirer.headline ? (
            <p className="text-muted-foreground">{job.hirer.headline}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {job.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <DetailItem label="Budget" value={formatBudgetRange(job)} />
          <DetailItem label="Type" value={getBudgetTypeLabel(job.budgetType)} />
          <DetailItem
            label="Experience"
            value={getExperienceLevelLabel(job.experienceLevel)}
          />
          <DetailItem label="Duration" value={getDurationLabel(job.estimatedDuration)} />
          <DetailItem
            label="Location"
            value={job.remoteOnly ? "Remote" : getCountryLabel(job.country) ?? "On-site"}
          />
          <DetailItem
            label="Proposals"
            value={`${job.proposalsCount} submitted`}
          />
        </CardContent>
      </Card>

      {job.requiredSkills.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Required skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {job.requiredSkills.map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {job.tags.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {job.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Separator />

      <ProposalForm job={job} onSubmitted={() => void loadJob()} />
    </div>
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
