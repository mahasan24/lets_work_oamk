import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent } from "@lets_work/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@lets_work/ui/components/field";
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
import { ArrowLeft, Search, SlidersHorizontal, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import { SkillsTagsInput } from "@/components/dashboard/skills-tags-input";
import { authClient } from "@/lib/auth-client";
import { getDashboardHomePath } from "@/lib/dashboard-paths";
import { AVAILABILITY_OPTIONS, COUNTRIES, SKILL_SUGGESTIONS } from "@/lib/profile-options";
import { profileApi, type ProfileBundle } from "@/lib/profile-api";
import {
  formatHourlyRate,
  formatLocation,
  formatRating,
  getAvailabilityLabel,
} from "@/lib/public-profile-utils";
import {
  publicProfilesApi,
  type FreelancerCard,
  type FreelancerSearchQuery,
  type FreelancerSort,
} from "@/lib/public-profiles-api";

const SORT_OPTIONS: { value: FreelancerSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "rate_low", label: "Lowest rate" },
  { value: "rate_high", label: "Highest rate" },
  { value: "newest", label: "Newest" },
];

const MIN_RATING_OPTIONS = [
  { value: "4.5", label: "4.5 and up" },
  { value: "4", label: "4.0 and up" },
  { value: "3", label: "3.0 and up" },
];

const PAGE_SIZE = 12;

type DirectoryFilters = {
  search: string;
  skills: string[];
  country: string;
  availability: FreelancerSearchQuery["availability"] | "";
  minRate: string;
  maxRate: string;
  minRating: string;
  sort: FreelancerSort;
};

const DEFAULT_FILTERS: DirectoryFilters = {
  search: "",
  skills: [],
  country: "",
  availability: "",
  minRate: "",
  maxRate: "",
  minRating: "",
  sort: "recommended",
};

function filtersToQuery(
  filters: DirectoryFilters,
  debouncedSearch: string,
  page: number,
): FreelancerSearchQuery {
  return {
    search: debouncedSearch || undefined,
    skills: filters.skills.length > 0 ? filters.skills : undefined,
    country: filters.country || undefined,
    availability: filters.availability || undefined,
    minRate: filters.minRate || undefined,
    maxRate: filters.maxRate || undefined,
    minRating: filters.minRating || undefined,
    sort: filters.sort,
    page,
    limit: PAGE_SIZE,
  };
}

export function FreelancerDirectory() {
  const { data: session } = authClient.useSession();
  const [profile, setProfile] = useState<ProfileBundle | null>(null);
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [freelancers, setFreelancers] = useState<FreelancerCard[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    profileApi
      .getMe()
      .then((bundle) => {
        if (!cancelled) setProfile(bundle);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  const homePath = session ? getDashboardHomePath(profile) : "/login";
  const query = useMemo(
    () => filtersToQuery(filters, debouncedSearch, page),
    [debouncedSearch, filters, page],
  );

  const loadFreelancers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await publicProfilesApi.searchFreelancers(query);
      setFreelancers(response.items);
      setTotal(response.pagination.total);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch {
      toast.error("Failed to load freelancers");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadFreelancers();
  }, [loadFreelancers]);

  const updateFilter = <K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    filters.skills.length > 0 ||
    Boolean(filters.country) ||
    Boolean(filters.availability) ||
    Boolean(filters.minRate) ||
    Boolean(filters.maxRate) ||
    Boolean(filters.minRating) ||
    filters.sort !== "recommended";

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={homePath}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to home
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Find talent</h1>
        <p className="text-muted-foreground">
          Browse freelancers by skill, location, rate, and rating.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-11 pl-10"
            placeholder="Search by name, headline, or bio"
            aria-label="Search freelancers"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => setShowFilters((current) => !current)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
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
              <Field className="md:col-span-2">
                <FieldLabel>Skills</FieldLabel>
                <SkillsTagsInput
                  value={filters.skills}
                  onChange={(skills) => updateFilter("skills", skills)}
                  suggestions={SKILL_SUGGESTIONS}
                  placeholder="Add a skill to filter by"
                  helperText="Freelancers must match every skill you add."
                />
              </Field>
              <Field>
                <FieldLabel>Country</FieldLabel>
                <SearchableCombobox
                  value={filters.country}
                  onValueChange={(value) => updateFilter("country", value)}
                  options={COUNTRIES}
                  placeholder="Any country"
                />
              </Field>
              <Field>
                <FieldLabel>Availability</FieldLabel>
                <Select
                  value={filters.availability || "all"}
                  onValueChange={(value) =>
                    updateFilter(
                      "availability",
                      value === "all" ? "" : (value as DirectoryFilters["availability"]),
                    )
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    {filters.availability
                      ? AVAILABILITY_OPTIONS.find((o) => o.value === filters.availability)?.label
                      : "Any availability"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Any availability</SelectItem>
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="min-rate">Min hourly rate</FieldLabel>
                <Input
                  id="min-rate"
                  className="h-10"
                  inputMode="decimal"
                  placeholder="e.g. 25"
                  value={filters.minRate}
                  onChange={(event) => updateFilter("minRate", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="max-rate">Max hourly rate</FieldLabel>
                <Input
                  id="max-rate"
                  className="h-10"
                  inputMode="decimal"
                  placeholder="e.g. 120"
                  value={filters.maxRate}
                  onChange={(event) => updateFilter("maxRate", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Minimum rating</FieldLabel>
                <Select
                  value={filters.minRating || "all"}
                  onValueChange={(value) =>
                    updateFilter("minRating", !value || value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    {filters.minRating
                      ? MIN_RATING_OPTIONS.find((o) => o.value === filters.minRating)?.label
                      : "Any rating"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Any rating</SelectItem>
                      {MIN_RATING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Sort by</FieldLabel>
                <Select
                  value={filters.sort}
                  onValueChange={(value) => updateFilter("sort", value as FreelancerSort)}
                >
                  <SelectTrigger className="h-10 w-full">
                    {SORT_OPTIONS.find((o) => o.value === filters.sort)?.label}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : freelancers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No freelancers found</p>
            <p className="text-sm text-muted-foreground">
              Try removing a filter or searching for a broader skill.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} freelancer{total === 1 ? "" : "s"} found
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {freelancers.map((freelancer) => (
              <FreelancerResultCard key={freelancer.userId} freelancer={freelancer} />
            ))}
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FreelancerResultCard({ freelancer }: { freelancer: FreelancerCard }) {
  const rate = formatHourlyRate(freelancer.hourlyRate, freelancer.currency);
  const rating = formatRating(freelancer.avgRating);
  const location = formatLocation(freelancer.country, freelancer.city);

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-14">
            <AvatarImage src={freelancer.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{freelancer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Link
              to="/freelancers/$userId"
              params={{ userId: freelancer.userId }}
              className="font-semibold hover:underline"
            >
              {freelancer.name}
            </Link>
            {freelancer.headline ? (
              <p className="line-clamp-1 text-sm text-muted-foreground">{freelancer.headline}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {[location, getAvailabilityLabel(freelancer.availabilityStatus)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
            {rate ? <span className="font-medium">{rate}</span> : null}
            {rating ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Star className="size-3.5 fill-current" aria-hidden />
                {rating}
                <span className="sr-only">average rating</span>
                <span aria-hidden>({freelancer.reviewCount})</span>
              </span>
            ) : null}
          </div>
        </div>

        {freelancer.bio ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{freelancer.bio}</p>
        ) : null}

        {freelancer.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {freelancer.skills.slice(0, 6).map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
            {freelancer.skills.length > 6 ? (
              <Badge variant="outline">+{freelancer.skills.length - 6}</Badge>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            {freelancer.jobsCompleted} job{freelancer.jobsCompleted === 1 ? "" : "s"} completed
          </span>
          <Link
            to="/freelancers/$userId"
            params={{ userId: freelancer.userId }}
            className="text-sm font-medium text-primary hover:underline"
          >
            View profile
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
