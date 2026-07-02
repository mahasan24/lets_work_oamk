import { env } from "@lets_work/env/web";

import type { EstimatedDuration } from "./job-options";
import type { UploadSignature } from "./jobs-api";

const API_BASE = env.VITE_SERVER_URL;

export class ProposalsApiError extends Error {
  status: number;
  errors?: string[];

  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.name = "ProposalsApiError";
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
    throw new ProposalsApiError(
      error.error ?? "Request failed",
      response.status,
      Array.isArray(error.errors) ? error.errors : undefined,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  if (data === null) {
    return data as T;
  }

  return data as T;
}

export type ProposalAttachment = {
  id: string;
  url: string;
  fileName: string;
  mimeType?: string | null;
};

export type ProposalStatus =
  | "draft"
  | "submitted"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type Proposal = {
  id: string;
  jobId: string;
  freelancerUserId: string;
  coverLetter: string;
  proposedRate: string | null;
  estimatedDuration: EstimatedDuration | null;
  attachments: ProposalAttachment[];
  status: ProposalStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalWriteInput = {
  coverLetter?: string;
  proposedRate?: string | null;
  estimatedDuration?: EstimatedDuration | null;
  attachments?: ProposalAttachment[];
};

export const proposalsApi = {
  getForJob: (jobId: string) =>
    apiFetch<Proposal | null>(`/api/freelancer/jobs/${jobId}/proposal`),

  saveDraft: (jobId: string, body: ProposalWriteInput) =>
    apiFetch<Proposal>(`/api/freelancer/jobs/${jobId}/proposal`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  submit: (jobId: string, body?: ProposalWriteInput) =>
    apiFetch<Proposal>(`/api/freelancer/jobs/${jobId}/proposal/submit`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  withdraw: (proposalId: string) =>
    apiFetch<Proposal>(`/api/freelancer/proposals/${proposalId}/withdraw`, {
      method: "POST",
    }),

  getUploadSignature: () => apiFetch<UploadSignature>("/api/freelancer/proposals/uploads/sign"),
};

export function getProposalStatusLabel(status: ProposalStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "shortlisted":
      return "Shortlisted";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    default:
      return status;
  }
}

export const PROPOSAL_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

export const PROPOSAL_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "rate_low", label: "Lowest bid" },
  { value: "rate_high", label: "Highest bid" },
] as const;

export type HirerProposalFreelancer = {
  id: string;
  name: string;
  image: string | null;
  headline: string | null;
  country: string | null;
  city: string | null;
  skills: string[];
  profileCompletion: number;
  hourlyRate: string | null;
  avgRating: string | null;
  reviewCount: number;
  jobsCompleted: number;
};

export type HirerProposal = Proposal & {
  job: {
    id: string;
    title: string;
    budgetType: "hourly" | "one_time";
    currency: string;
  };
  freelancer: HirerProposalFreelancer;
};

export type HirerProposalListResponse = {
  job: {
    id: string;
    title: string;
    status: string;
    proposalsCount: number;
    budgetType: "hourly" | "one_time";
    currency: string;
  };
  items: HirerProposal[];
  meta: {
    total: number;
    statusCounts: Partial<Record<ProposalStatus, number>>;
  };
};

export type HirerProposalBrowseQuery = {
  status?: Exclude<ProposalStatus, "draft">;
  sort?: "newest" | "rate_low" | "rate_high";
};

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const hirerProposalsApi = {
  listForJob: (jobId: string, query?: HirerProposalBrowseQuery) =>
    apiFetch<HirerProposalListResponse>(
      `/api/hirer/jobs/${jobId}/proposals${buildQuery({
        status: query?.status,
        sort: query?.sort,
      })}`,
    ),

  get: (proposalId: string) => apiFetch<HirerProposal>(`/api/hirer/proposals/${proposalId}`),
};
