import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { JobBrowse } from "@/components/freelancer/job-browse";
import { ContractProgressSummaryCard } from "@/components/contracts/contract-progress-summary";
import { jobsApi } from "@/lib/jobs-api";
import { mergeJobCategorySuggestions } from "@/lib/hirer-options";

export const Route = createFileRoute("/dashboard/freelancer/")({
  component: FreelancerDashboardHome,
});

function FreelancerDashboardHome() {
  const [categories, setCategories] = useState<string[]>(mergeJobCategorySuggestions());

  useEffect(() => {
    jobsApi
      .getReferenceData()
      .then((data) => setCategories([...data.categories]))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Find work
            </Badge>
            <h2 className="text-lg font-semibold">Browse open jobs</h2>
            <p className="text-sm text-muted-foreground">
              Search and filter opportunities that match your skills, budget preferences, and
              availability.
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

      <JobBrowse categories={categories} />
    </div>
  );
}
