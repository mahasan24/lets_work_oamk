import { env } from "@lets_work/env/web";

import type { BudgetType, EstimatedDuration, ExperienceLevel, JobStatus } from "./job-options";
import type { PublicJob } from "./jobs-api";
import type { ProposalStatus } from "./proposals-api";

const API_BASE = env.VITE_SERVER_URL;

export class FreelancerJobsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FreelancerJobsApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new FreelancerJobsApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type JobFeedTab = "best_match" | "newest" | "saved";

export type JobFeedItem = PublicJob & {
  /** Job skills that also appear on the freelancer's profile. */
  matchedSkills: string[];
  /** Share of the job's required skills the freelancer covers, 0-100. */
  matchPercent: number;
  proposalStatus: ProposalStatus | null;
  proposalSubmittedAt: string | null;
  isSaved: boolean;
  /** Present when loaded from AI recommendations. */
  aiScore?: number;
  aiReason?: string;
};

export type JobFeedResponse = {
  items: JobFeedItem[];
  profileSkills: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type JobFeedQuery = {
  tab?: JobFeedTab;
  search?: string;
  category?: string;
  skills?: string[];
  experienceLevel?: ExperienceLevel;
  budgetType?: BudgetType;
  minBudget?: string;
  maxBudget?: string;
  postedWithin?: "24h" | "7d" | "30d";
  remoteOnly?: boolean;
  page?: number;
  limit?: number;
};

export type FreelancerProposalSummary = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobSlug: string | null;
  jobStatus: JobStatus;
  jobCurrency: string;
  jobBudgetType: BudgetType;
  jobProposalsCount: number;
  hirerUserId: string;
  hirerDisplayName: string;
  coverLetter: string;
  proposedRate: string | null;
  estimatedDuration: EstimatedDuration | null;
  status: ProposalStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FreelancerProposalListResponse = {
  items: FreelancerProposalSummary[];
  statusCounts: Partial<Record<ProposalStatus, number>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function buildFeedQuery(query?: JobFeedQuery) {
  const search = new URLSearchParams();

  const scalars: Record<string, string | number | boolean | undefined> = {
    tab: query?.tab,
    search: query?.search,
    category: query?.category,
    experienceLevel: query?.experienceLevel,
    budgetType: query?.budgetType,
    minBudget: query?.minBudget,
    maxBudget: query?.maxBudget,
    postedWithin: query?.postedWithin,
    remoteOnly: query?.remoteOnly ? true : undefined,
    page: query?.page,
    limit: query?.limit,
  };

  for (const [key, value] of Object.entries(scalars)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }

  for (const skill of query?.skills ?? []) {
    if (skill.trim()) search.append("skills", skill.trim());
  }

  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export const freelancerJobsApi = {
  feed: (query?: JobFeedQuery) =>
    apiFetch<JobFeedResponse>(`/api/freelancer/job-feed${buildFeedQuery(query)}`),

  listProposals: (query?: { status?: ProposalStatus; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (query?.status) search.set("status", query.status);
    if (query?.page) search.set("page", String(query.page));
    if (query?.limit) search.set("limit", String(query.limit));
    const queryString = search.toString();
    return apiFetch<FreelancerProposalListResponse>(
      `/api/freelancer/proposals${queryString ? `?${queryString}` : ""}`,
    );
  },

  saveJob: (jobId: string) =>
    apiFetch<{ saved: boolean }>(`/api/freelancer/saved-jobs/${encodeURIComponent(jobId)}`, {
      method: "POST",
    }),

  unsaveJob: (jobId: string) =>
    apiFetch<{ saved: boolean }>(`/api/freelancer/saved-jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),

  aiRecommendations: (body?: { limit?: number }) =>
    apiFetch<{
      items: JobFeedItem[];
      model: string | null;
      profileSkills: string[];
    }>("/api/freelancer/job-recommendations", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
};
