import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class DisputesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DisputesApiError";
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
    throw new DisputesApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type DisputeStatus =
  "open" | "under_review" | "resolved_client" | "resolved_freelancer" | "closed";

export type Dispute = {
  id: string;
  contractId: string;
  milestoneId: string | null;
  openedByUserId: string;
  respondentUserId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DisputeListItem = Dispute & {
  contractTitle: string;
  contractStatus: string;
  milestoneTitle: string | null;
  openedByName: string;
  respondentName: string;
  direction: "opened" | "received";
};

export type DisputeDetail = DisputeListItem & {
  contractPathRole: "hirer" | "freelancer";
};

export type DisputeListResponse = {
  items: DisputeListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const disputesApi = {
  list: (params?: { page?: number; limit?: number; status?: DisputeStatus }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiFetch<DisputeListResponse>(`/api/disputes${qs ? `?${qs}` : ""}`);
  },

  get: (disputeId: string) => apiFetch<DisputeDetail>(`/api/disputes/${disputeId}`),

  getActiveForContract: (contractId: string) =>
    apiFetch<Dispute | null>(`/api/disputes/by-contract/${contractId}`),
};

export function getDisputeStatusLabel(status: DisputeStatus | string) {
  switch (status) {
    case "open":
      return "Open";
    case "under_review":
      return "Under review";
    case "resolved_client":
      return "Resolved for client";
    case "resolved_freelancer":
      return "Resolved for freelancer";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export const DISPUTE_RESOLUTION_OPTIONS = [
  { value: "resolved_client" as const, label: "Resolve for client" },
  { value: "resolved_freelancer" as const, label: "Resolve for freelancer" },
  { value: "closed" as const, label: "Close without winner" },
];

export function getDisputeResolutionLabel(status: string) {
  return (
    DISPUTE_RESOLUTION_OPTIONS.find((option) => option.value === status)?.label ??
    getDisputeStatusLabel(status)
  );
}
