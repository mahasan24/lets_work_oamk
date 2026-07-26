import type { JobFeedTab } from "@/lib/freelancer-jobs-api";
import type { BudgetType, ExperienceLevel } from "@/lib/job-options";

export type JobFeedFilters = {
  tab: JobFeedTab;
  search: string;
  category: string;
  skills: string[];
  experienceLevel: ExperienceLevel | "";
  budgetType: BudgetType | "";
  minBudget: string;
  maxBudget: string;
  postedWithin: "24h" | "7d" | "30d" | "";
  remoteOnly: boolean;
  page: number;
};

/**
 * Shape stored in the URL. Every key is optional so a clean feed has a clean URL.
 */
export type JobFeedSearchParams = {
  tab?: JobFeedTab;
  q?: string;
  category?: string;
  skills?: string[];
  level?: ExperienceLevel;
  budget?: BudgetType;
  min?: string;
  max?: string;
  posted?: "24h" | "7d" | "30d";
  remote?: boolean;
  page?: number;
};

export const DEFAULT_JOB_FEED_FILTERS: JobFeedFilters = {
  tab: "best_match",
  search: "",
  category: "",
  skills: [],
  experienceLevel: "",
  budgetType: "",
  minBudget: "",
  maxBudget: "",
  postedWithin: "",
  remoteOnly: false,
  page: 1,
};

const TABS: JobFeedTab[] = ["best_match", "newest", "saved"];
const LEVELS: ExperienceLevel[] = ["entry", "intermediate", "expert"];
const BUDGET_TYPES: BudgetType[] = ["hourly", "one_time"];
const POSTED_WINDOWS = ["24h", "7d", "30d"] as const;

function pickLiteral<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickStringArray(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const normalized = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

export function validateJobFeedSearch(search: Record<string, unknown>): JobFeedSearchParams {
  const page = Number(search.page);

  return {
    tab: pickLiteral(search.tab, TABS),
    q: pickString(search.q),
    category: pickString(search.category),
    skills: pickStringArray(search.skills),
    level: pickLiteral(search.level, LEVELS),
    budget: pickLiteral(search.budget, BUDGET_TYPES),
    min: pickString(search.min),
    max: pickString(search.max),
    posted: pickLiteral(search.posted, POSTED_WINDOWS),
    remote: search.remote === true || search.remote === "true" ? true : undefined,
    page: Number.isFinite(page) && page > 1 ? Math.floor(page) : undefined,
  };
}

export function searchParamsToFilters(params: JobFeedSearchParams): JobFeedFilters {
  return {
    tab: params.tab ?? DEFAULT_JOB_FEED_FILTERS.tab,
    search: params.q ?? "",
    category: params.category ?? "",
    skills: params.skills ?? [],
    experienceLevel: params.level ?? "",
    budgetType: params.budget ?? "",
    minBudget: params.min ?? "",
    maxBudget: params.max ?? "",
    postedWithin: params.posted ?? "",
    remoteOnly: params.remote ?? false,
    page: params.page ?? 1,
  };
}

/** Drops defaults so the URL only carries what the freelancer actually chose. */
export function filtersToSearchParams(filters: JobFeedFilters): JobFeedSearchParams {
  return {
    tab: filters.tab === DEFAULT_JOB_FEED_FILTERS.tab ? undefined : filters.tab,
    q: filters.search || undefined,
    category: filters.category || undefined,
    skills: filters.skills.length > 0 ? filters.skills : undefined,
    level: filters.experienceLevel || undefined,
    budget: filters.budgetType || undefined,
    min: filters.minBudget || undefined,
    max: filters.maxBudget || undefined,
    posted: filters.postedWithin || undefined,
    remote: filters.remoteOnly || undefined,
    page: filters.page > 1 ? filters.page : undefined,
  };
}
