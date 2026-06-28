import { env } from "@lets_work/env/web";

import type {
  BudgetType,
  EstimatedDuration,
  ExperienceLevel,
  JobStatus,
} from "./job-options";

const API_BASE = env.VITE_SERVER_URL;

export class JobsApiError extends Error {
  status: number;
  errors?: string[];

  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.name = "JobsApiError";
    this.status = status;
    this.errors = errors;
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
    throw new JobsApiError(
      error.error ?? "Request failed",
      response.status,
      Array.isArray(error.errors) ? error.errors : undefined,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type JobAttachment = {
  id: string;
  url: string;
  fileName: string;
  mimeType?: string | null;
};

export type Job = {
  id: string;
  hirerUserId: string;
  title: string;
  slug: string | null;
  description: string;
  category: string;
  requiredSkills: string[];
  budgetType: BudgetType;
  budgetMin: string | null;
  budgetMax: string | null;
  hourlyRateMin: string | null;
  hourlyRateMax: string | null;
  remoteOnly: boolean;
  country: string | null;
  currency: string;
  experienceLevel: ExperienceLevel | null;
  estimatedDuration: EstimatedDuration | null;
  weeklyHours: number | null;
  preferredTimezone: string | null;
  tags: string[];
  attachments: JobAttachment[];
  status: JobStatus;
  proposalsCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobWriteInput = {
  title?: string;
  description?: string;
  category?: string;
  requiredSkills?: string[];
  budgetType?: BudgetType;
  budgetMin?: string | null;
  budgetMax?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  remoteOnly?: boolean;
  country?: string | null;
  currency?: string;
  experienceLevel?: ExperienceLevel | null;
  estimatedDuration?: EstimatedDuration | null;
  weeklyHours?: number | null;
  preferredTimezone?: string | null;
  tags?: string[];
  attachments?: JobAttachment[];
};

export type JobListResponse = {
  items: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type JobPublishReadiness = {
  ready: boolean;
  errors: string[];
  status: JobStatus;
};

export type JobReferenceData = {
  categories: readonly string[];
  currencies: readonly string[];
};

export type UploadSignature = {
  timestamp: number;
  signature: string;
  folder: string;
  cloudName: string;
  apiKey: string;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const jobsApi = {
  getReferenceData: () => apiFetch<JobReferenceData>("/api/jobs/categories"),

  listMine: (query?: {
    status?: JobStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    apiFetch<JobListResponse>(
      `/api/hirer/jobs${buildQuery({
        status: query?.status,
        search: query?.search,
        page: query?.page,
        limit: query?.limit,
      })}`,
    ),

  getMine: (id: string) => apiFetch<Job>(`/api/hirer/jobs/${id}`),

  create: (body: JobWriteInput) =>
    apiFetch<Job>("/api/hirer/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: JobWriteInput) =>
    apiFetch<Job>(`/api/hirer/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/hirer/jobs/${id}`, { method: "DELETE" }),

  getPublishReadiness: (id: string) =>
    apiFetch<JobPublishReadiness>(`/api/hirer/jobs/${id}/readiness`),

  publish: (id: string) =>
    apiFetch<Job>(`/api/hirer/jobs/${id}/publish`, { method: "POST" }),

  pause: (id: string) => apiFetch<Job>(`/api/hirer/jobs/${id}/pause`, { method: "POST" }),

  resume: (id: string) => apiFetch<Job>(`/api/hirer/jobs/${id}/resume`, { method: "POST" }),

  close: (id: string) => apiFetch<Job>(`/api/hirer/jobs/${id}/close`, { method: "POST" }),

  getUploadSignature: () => apiFetch<UploadSignature>("/api/hirer/jobs/uploads/sign"),
};
