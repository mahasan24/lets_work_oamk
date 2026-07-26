import { Badge } from "@lets_work/ui/components/badge";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ContractProgressSummaryCard } from "@/components/contracts/contract-progress-summary";
import { JobFeed } from "@/components/freelancer/job-feed";
import {
  DEFAULT_JOB_FEED_FILTERS,
  filtersToSearchParams,
  searchParamsToFilters,
  validateJobFeedSearch,
  type JobFeedFilters,
} from "@/components/freelancer/job-feed-filters";
import { mergeJobCategorySuggestions } from "@/lib/hirer-options";
import { jobsApi } from "@/lib/jobs-api";
import { SKILL_SUGGESTIONS } from "@/lib/profile-options";

export const Route = createFileRoute("/dashboard/freelancer/")({
  component: FreelancerFindWork,
  validateSearch: validateJobFeedSearch,
});

function FreelancerFindWork() {
  const navigate = useNavigate({ from: "/dashboard/freelancer/" });
  const search = Route.useSearch();
  const [categories, setCategories] = useState<string[]>(mergeJobCategorySuggestions());

  useEffect(() => {
    jobsApi
      .getReferenceData()
      .then((data) => setCategories([...data.categories]))
      .catch(() => {});
  }, []);

  const filters = useMemo(() => searchParamsToFilters(search), [search]);

  const handleFiltersChange = useCallback(
    (next: Partial<JobFeedFilters>) => {
      void navigate({
        search: (current) => filtersToSearchParams({ ...searchParamsToFilters(current), ...next }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleResetFilters = useCallback(() => {
    void navigate({
      search: () => filtersToSearchParams({ ...DEFAULT_JOB_FEED_FILTERS, tab: filters.tab }),
      replace: true,
    });
  }, [navigate, filters.tab]);

  const skillSuggestions = useMemo(() => [...SKILL_SUGGESTIONS], []);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Find work
            </Badge>
            <h2 className="text-lg font-semibold">Jobs matched to your skills</h2>
            <p className="text-sm text-muted-foreground">
              Best matches rank open jobs against the skills on your profile. Switch to Most recent
              for the newest postings, or filter by skill, budget, and experience level.
            </p>
          </div>
          <Link
            to="/dashboard/freelancer/profile"
            className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
          >
            Improve your profile
          </Link>
        </CardContent>
      </Card>

      <ContractProgressSummaryCard role="freelancer" />

      <JobFeed
        filters={filters}
        categories={categories}
        skillSuggestions={skillSuggestions}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
}
