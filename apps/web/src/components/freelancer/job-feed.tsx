import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Checkbox } from "@lets_work/ui/components/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@lets_work/ui/components/select";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@lets_work/ui/components/tabs";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import { SkillsTagsInput } from "@/components/dashboard/skills-tags-input";
import { freelancerJobsApi, type JobFeedItem, type JobFeedTab } from "@/lib/freelancer-jobs-api";
import {
  BUDGET_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  POSTED_WITHIN_OPTIONS,
} from "@/lib/job-options";
import { formatJobMetaLine, formatRelativeJobDate } from "@/lib/job-utils";

import type { JobFeedFilters } from "./job-feed-filters";

const TAB_OPTIONS: { value: JobFeedTab; label: string }[] = [
  { value: "best_match", label: "Best matches" },
  { value: "newest", label: "Most recent" },
  { value: "saved", label: "Saved jobs" },
];

const PAGE_SIZE = 20;

type JobFeedProps = {
  filters: JobFeedFilters;
  categories: string[];
  skillSuggestions: string[];
  onFiltersChange: (next: Partial<JobFeedFilters>) => void;
  onResetFilters: () => void;
};

export function JobFeed({
  filters,
  categories,
  skillSuggestions,
  onFiltersChange,
  onResetFilters,
}: JobFeedProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const [items, setItems] = useState<JobFeedItem[]>([]);
  const [profileSkills, setProfileSkills] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showingAi, setShowingAi] = useState(false);

  // Sync on back/forward and reset, but leave whitespace the user is mid-typing alone.
  useEffect(() => {
    setSearchInput((current) => (current.trim() === filters.search ? current : filters.search));
  }, [filters.search]);

  useEffect(() => {
    if (searchInput.trim() === filters.search) return;
    const timeout = window.setTimeout(() => {
      onFiltersChange({ search: searchInput.trim(), page: 1 });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput, filters.search, onFiltersChange]);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    setShowingAi(false);
    try {
      const response = await freelancerJobsApi.feed({
        tab: filters.tab,
        search: filters.search || undefined,
        category: filters.category || undefined,
        skills: filters.skills.length > 0 ? filters.skills : undefined,
        experienceLevel: filters.experienceLevel || undefined,
        budgetType: filters.budgetType || undefined,
        minBudget: filters.minBudget || undefined,
        maxBudget: filters.maxBudget || undefined,
        postedWithin: filters.postedWithin || undefined,
        remoteOnly: filters.remoteOnly || undefined,
        page: filters.page,
        limit: PAGE_SIZE,
      });
      setItems(response.items);
      setProfileSkills(response.profileSkills);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const toggleSaved = useCallback(async (item: JobFeedItem) => {
    setSavingJobId(item.id);
    const nextSaved = !item.isSaved;
    try {
      if (nextSaved) {
        await freelancerJobsApi.saveJob(item.id);
      } else {
        await freelancerJobsApi.unsaveJob(item.id);
      }
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isSaved: nextSaved } : entry)),
      );
      toast.success(nextSaved ? "Job saved" : "Removed from saved jobs");
    } catch {
      toast.error(nextSaved ? "Could not save this job" : "Could not remove this job");
    } finally {
      setSavingJobId(null);
    }
  }, []);

  const loadAiRecommendations = async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    try {
      const response = await freelancerJobsApi.aiRecommendations({ limit: 8 });
      setItems(response.items);
      setProfileSkills(response.profileSkills);
      setTotal(response.items.length);
      setTotalPages(1);
      setShowingAi(true);
      toast.success("AI recommendations ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI recommendations failed");
    } finally {
      setIsAiLoading(false);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count += 1;
    if (filters.category) count += 1;
    if (filters.skills.length > 0) count += filters.skills.length;
    if (filters.experienceLevel) count += 1;
    if (filters.budgetType) count += 1;
    if (filters.minBudget) count += 1;
    if (filters.maxBudget) count += 1;
    if (filters.postedWithin) count += 1;
    if (filters.remoteOnly) count += 1;
    return count;
  }, [filters]);

  const showMatchPrompt = filters.tab === "best_match" && !isLoading && profileSkills.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-10"
          placeholder="Search jobs by title or description"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filters.tab}
          onValueChange={(value) => onFiltersChange({ tab: value as JobFeedTab, page: 1 })}
        >
          <TabsList>
            {TAB_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {filters.tab === "best_match" && profileSkills.length > 0 ? (
            <Button
              type="button"
              variant={showingAi ? "default" : "outline"}
              size="sm"
              disabled={isAiLoading || isLoading}
              onClick={() => void loadAiRecommendations()}
            >
              <Sparkles className="size-4" />
              {isAiLoading ? "Ranking…" : showingAi ? "Refresh AI picks" : "AI recommendations"}
            </Button>
          ) : null}
          {showingAi ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadFeed()}
            >
              Show skill matches
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setShowFilters((open) => !open)}>
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </div>
      </div>

      {showingAi ? (
        <p className="text-sm text-muted-foreground">
          Showing Gemini-ranked picks for your profile. Reasons appear under each job.
        </p>
      ) : null}

      {showFilters ? (
        <Card>
          <CardContent className="pt-6">
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field className="md:col-span-2">
                <FieldLabel>Skills</FieldLabel>
                <SkillsTagsInput
                  value={filters.skills}
                  onChange={(skills) => onFiltersChange({ skills, page: 1 })}
                  suggestions={skillSuggestions}
                  placeholder="Filter by skill, e.g. React"
                  helperText="Shows jobs asking for any of these skills."
                />
              </Field>
              <Field>
                <FieldLabel>Category</FieldLabel>
                <SearchableCombobox
                  value={filters.category}
                  onValueChange={(value) => onFiltersChange({ category: value, page: 1 })}
                  options={categories.map((item) => ({ value: item, label: item }))}
                  placeholder="All categories"
                />
              </Field>
              <Field>
                <FieldLabel>Experience level</FieldLabel>
                <Select
                  value={filters.experienceLevel || "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      experienceLevel:
                        !value || value === "all"
                          ? ""
                          : (value as JobFeedFilters["experienceLevel"]),
                      page: 1,
                    })
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
                    onFiltersChange({
                      budgetType:
                        !value || value === "all" ? "" : (value as JobFeedFilters["budgetType"]),
                      page: 1,
                    })
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
                    onFiltersChange({
                      postedWithin:
                        !value || value === "all" ? "" : (value as JobFeedFilters["postedWithin"]),
                      page: 1,
                    })
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
                  onChange={(event) => onFiltersChange({ minBudget: event.target.value, page: 1 })}
                />
              </Field>
              <Field>
                <FieldLabel>Max budget / rate</FieldLabel>
                <Input
                  className="h-10"
                  inputMode="decimal"
                  placeholder="e.g. 5000"
                  value={filters.maxBudget}
                  onChange={(event) => onFiltersChange({ maxBudget: event.target.value, page: 1 })}
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  checked={filters.remoteOnly}
                  onCheckedChange={(checked) =>
                    onFiltersChange({ remoteOnly: checked === true, page: 1 })
                  }
                />
                <FieldContent>
                  <FieldLabel>Remote only</FieldLabel>
                </FieldContent>
              </Field>
            </FieldGroup>
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" className="mt-4" onClick={onResetFilters}>
                Clear all filters
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showMatchPrompt ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-sm font-medium">Add skills to unlock matching</p>
            <p className="text-sm text-muted-foreground">
              We rank jobs against the skills on your profile. Add a few and this tab will surface
              the work that actually fits you.
            </p>
            <Link
              to="/dashboard/freelancer/profile"
              className="text-sm font-medium text-primary hover:underline"
            >
              Add skills to your profile
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyFeed tab={filters.tab} hasFilters={activeFilterCount > 0} onReset={onResetFilters} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} job{total === 1 ? "" : "s"} found
          </p>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <JobFeedCard
                key={item.id}
                item={item}
                isSaving={savingJobId === item.id}
                onToggleSaved={toggleSaved}
              />
            ))}
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => onFiltersChange({ page: filters.page - 1 })}
          >
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => onFiltersChange({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyFeed({
  tab,
  hasFilters,
  onReset,
}: {
  tab: JobFeedTab;
  hasFilters: boolean;
  onReset: () => void;
}) {
  if (tab === "saved") {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">No saved jobs yet</p>
          <p className="text-sm text-muted-foreground">
            Use the bookmark button on any job to keep it here for later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <p className="font-medium">No jobs found</p>
        <p className="text-sm text-muted-foreground">
          Try broadening your search or removing a filter to see more opportunities.
        </p>
        {hasFilters ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={onReset}>
            Clear all filters
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function JobFeedCard({
  item,
  isSaving,
  onToggleSaved,
}: {
  item: JobFeedItem;
  isSaving: boolean;
  onToggleSaved: (item: JobFeedItem) => void;
}) {
  const matchedSkillSet = useMemo(
    () => new Set(item.matchedSkills.map((skill) => skill.toLowerCase())),
    [item.matchedSkills],
  );

  const hasApplied =
    item.proposalStatus != null &&
    item.proposalStatus !== "draft" &&
    item.proposalStatus !== "withdrawn";

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Posted {formatRelativeJobDate(item.publishedAt ?? item.createdAt)} ·{" "}
              {item.proposalsCount} proposal{item.proposalsCount === 1 ? "" : "s"}
            </p>
            {item.slug ? (
              <Link
                to="/dashboard/freelancer/jobs/$slug"
                params={{ slug: item.slug }}
                className="hover:underline"
              >
                <CardTitle className="text-base leading-snug font-semibold">{item.title}</CardTitle>
              </Link>
            ) : (
              <CardTitle className="text-base leading-snug font-semibold">{item.title}</CardTitle>
            )}
            <p className="text-sm text-muted-foreground">{formatJobMetaLine(item)}</p>
            <p className="text-xs text-muted-foreground">
              {item.hirer.displayName}
              {item.hirer.headline ? ` · ${item.hirer.headline}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={item.isSaved ? "Remove from saved jobs" : "Save job"}
              aria-pressed={item.isSaved}
              disabled={isSaving}
              onClick={() => onToggleSaved(item)}
            >
              {item.isSaved ? (
                <BookmarkCheck className="size-4 text-primary" />
              ) : (
                <Bookmark className="size-4" />
              )}
            </Button>
            <Badge variant="secondary">{item.category}</Badge>
            {item.remoteOnly ? <Badge variant="outline">Remote</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>

        {item.aiReason ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">Why it fits: </span>
            {item.aiReason}
            {typeof item.aiScore === "number" ? (
              <span className="text-muted-foreground"> · AI score {item.aiScore}</span>
            ) : null}
          </p>
        ) : null}

        {item.requiredSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.requiredSkills.slice(0, 8).map((skill) => {
              const isMatch = matchedSkillSet.has(skill.toLowerCase());
              return (
                <Badge
                  key={skill}
                  variant={isMatch ? "default" : "outline"}
                  className={cn("font-normal", isMatch && "gap-1")}
                >
                  {isMatch ? <Sparkles className="size-3" /> : null}
                  {skill}
                </Badge>
              );
            })}
            {item.requiredSkills.length > 8 ? (
              <Badge variant="outline" className="font-normal">
                +{item.requiredSkills.length - 8}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {item.matchedSkills.length > 0 ? (
            <span className="text-xs font-medium text-primary">
              {item.matchedSkills.length} of your skills match · covers {item.matchPercent}% of what
              they asked for
            </span>
          ) : null}
          {hasApplied ? (
            <Badge variant="secondary">
              {item.proposalStatus === "submitted" ? "Applied" : `Proposal ${item.proposalStatus}`}
            </Badge>
          ) : item.proposalStatus === "draft" ? (
            <Badge variant="outline">Draft saved</Badge>
          ) : null}
          {item.slug ? (
            <Link
              to="/dashboard/freelancer/jobs/$slug"
              params={{ slug: item.slug }}
              className="ml-auto text-sm font-medium text-primary hover:underline"
            >
              View job
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
