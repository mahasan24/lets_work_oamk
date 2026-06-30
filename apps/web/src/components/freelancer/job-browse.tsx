import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Checkbox } from "@lets_work/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@lets_work/ui/components/select";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import {
  BUDGET_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  JOB_SORT_OPTIONS,
  POSTED_WITHIN_OPTIONS,
} from "@/lib/job-options";
import { formatJobMetaLine, formatRelativeJobDate } from "@/lib/job-utils";
import { jobsApi, type PublicJob, type PublicJobBrowseQuery } from "@/lib/jobs-api";

type JobBrowseFilters = {
  search: string;
  category: string;
  experienceLevel: PublicJobBrowseQuery["experienceLevel"] | "";
  budgetType: PublicJobBrowseQuery["budgetType"] | "";
  minBudget: string;
  maxBudget: string;
  postedWithin: PublicJobBrowseQuery["postedWithin"] | "";
  remoteOnly: boolean;
  sort: PublicJobBrowseQuery["sort"];
};

const DEFAULT_FILTERS: JobBrowseFilters = {
  search: "",
  category: "",
  experienceLevel: "",
  budgetType: "",
  minBudget: "",
  maxBudget: "",
  postedWithin: "",
  remoteOnly: false,
  sort: "newest",
};

function filtersToQuery(filters: JobBrowseFilters, debouncedSearch: string): PublicJobBrowseQuery {
  return {
    search: debouncedSearch || undefined,
    category: filters.category || undefined,
    experienceLevel: filters.experienceLevel || undefined,
    budgetType: filters.budgetType || undefined,
    minBudget: filters.minBudget || undefined,
    maxBudget: filters.maxBudget || undefined,
    postedWithin: filters.postedWithin || undefined,
    remoteOnly: filters.remoteOnly || undefined,
    sort: filters.sort,
    limit: 20,
  };
}

type JobBrowseProps = {
  categories: string[];
};

export function JobBrowse({ categories }: JobBrowseProps) {
  const [filters, setFilters] = useState<JobBrowseFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  const query = useMemo(
    () => filtersToQuery(filters, debouncedSearch),
    [filters, debouncedSearch],
  );

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await jobsApi.browse(query);
      setJobs(response.items);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const updateFilter = <K extends keyof JobBrowseFilters>(key: K, value: JobBrowseFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters =
    debouncedSearch ||
    filters.category ||
    filters.experienceLevel ||
    filters.budgetType ||
    filters.minBudget ||
    filters.maxBudget ||
    filters.postedWithin ||
    filters.remoteOnly ||
    filters.sort !== "newest";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-10"
          placeholder="Search for jobs"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Jobs you might like</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((current) => !current)}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {hasActiveFilters ? (
              <Badge variant="secondary" className="ml-1">
                On
              </Badge>
            ) : null}
          </Button>
        </div>

        {showFilters ? (
          <Card>
            <CardContent className="pt-6">
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <SearchableCombobox
                    value={filters.category}
                    onValueChange={(value) => updateFilter("category", value)}
                    options={categories.map((item) => ({ value: item, label: item }))}
                    placeholder="All categories"
                  />
                </Field>
                <Field>
                  <FieldLabel>Experience level</FieldLabel>
                  <Select
                    value={filters.experienceLevel || "all"}
                    onValueChange={(value) =>
                      updateFilter(
                        "experienceLevel",
                        value === "all" ? "" : (value as JobBrowseFilters["experienceLevel"]),
                      )
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      {filters.experienceLevel
                        ? EXPERIENCE_LEVEL_OPTIONS.find((o) => o.value === filters.experienceLevel)
                            ?.label
                        : "All levels"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All levels</SelectItem>
                        {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Budget type</FieldLabel>
                  <Select
                    value={filters.budgetType || "all"}
                    onValueChange={(value) =>
                      updateFilter(
                        "budgetType",
                        value === "all" ? "" : (value as JobBrowseFilters["budgetType"]),
                      )
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      {filters.budgetType
                        ? BUDGET_TYPE_OPTIONS.find((o) => o.value === filters.budgetType)?.label
                        : "All types"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All types</SelectItem>
                        {BUDGET_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Posted within</FieldLabel>
                  <Select
                    value={filters.postedWithin || "all"}
                    onValueChange={(value) =>
                      updateFilter(
                        "postedWithin",
                        value === "all" ? "" : (value as JobBrowseFilters["postedWithin"]),
                      )
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      {filters.postedWithin
                        ? POSTED_WITHIN_OPTIONS.find((o) => o.value === filters.postedWithin)?.label
                        : "Any time"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Any time</SelectItem>
                        {POSTED_WITHIN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Min budget / rate</FieldLabel>
                  <Input
                    className="h-10"
                    inputMode="decimal"
                    placeholder="e.g. 25"
                    value={filters.minBudget}
                    onChange={(event) => updateFilter("minBudget", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Max budget / rate</FieldLabel>
                  <Input
                    className="h-10"
                    inputMode="decimal"
                    placeholder="e.g. 5000"
                    value={filters.maxBudget}
                    onChange={(event) => updateFilter("maxBudget", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Sort by</FieldLabel>
                  <Select
                    value={filters.sort}
                    onValueChange={(value) =>
                      updateFilter("sort", value as JobBrowseFilters["sort"])
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      {JOB_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {JOB_SORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    checked={filters.remoteOnly}
                    onCheckedChange={(checked) => updateFilter("remoteOnly", checked === true)}
                  />
                  <FieldContent>
                    <FieldLabel>Remote only</FieldLabel>
                  </FieldContent>
                </Field>
              </FieldGroup>
              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="font-medium">No jobs found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters to see more opportunities.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-xs text-muted-foreground">
                        Posted {formatRelativeJobDate(job.publishedAt ?? job.createdAt)} ·{" "}
                        {job.proposalsCount} proposal{job.proposalsCount === 1 ? "" : "s"}
                      </p>
                      {job.slug ? (
                        <Link
                          to="/dashboard/freelancer/jobs/$slug"
                          params={{ slug: job.slug }}
                          className="hover:underline"
                        >
                          <CardTitle className="text-base leading-snug font-semibold">
                            {job.title}
                          </CardTitle>
                        </Link>
                      ) : (
                        <CardTitle className="text-base leading-snug font-semibold">
                          {job.title}
                        </CardTitle>
                      )}
                      <p className="text-sm text-muted-foreground">{formatJobMetaLine(job)}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.hirer.displayName}
                        {job.hirer.headline ? ` · ${job.hirer.headline}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant="secondary">{job.category}</Badge>
                      {job.remoteOnly ? <Badge variant="outline">Remote</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
                  {job.slug ? (
                    <Link
                      to="/dashboard/freelancer/jobs/$slug"
                      params={{ slug: job.slug }}
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      View job
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
