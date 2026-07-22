import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class MilestonesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MilestonesApiError";
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
    throw new MilestonesApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type MilestoneStatus =
  | "pending"
  | "funded"
  | "in_progress"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "released"
  | "disputed"
  | "cancelled";

export type MilestoneSubmission = {
  id: string;
  submittedByUserId: string;
  note: string | null;
  attachmentUrl: string | null;
  createdAt: string;
};

export type Milestone = {
  id: string;
  contractId: string;
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  sortOrder: number;
  status: MilestoneStatus;
  dueDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  revisionNote: string | null;
  createdAt: string;
  updatedAt: string;
  submissions: MilestoneSubmission[];
};

export type MilestoneListResponse = {
  items: Milestone[];
  meta: {
    total: number;
    approved: number;
    completionPercent: number;
    contractType: "hourly" | "one_time";
  };
};

export type CreateMilestoneInput = {
  title: string;
  description?: string;
  amount: string;
  dueDate?: string;
  sortOrder?: number;
};

export const milestonesApi = {
  list: (contractId: string) =>
    apiFetch<MilestoneListResponse>(`/api/contracts/${contractId}/milestones`),

  create: (contractId: string, body: CreateMilestoneInput) =>
    apiFetch<Milestone>(`/api/contracts/${contractId}/milestones`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (milestoneId: string, body: Partial<CreateMilestoneInput>) =>
    apiFetch<Milestone>(`/api/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (milestoneId: string) =>
    apiFetch<{ success: true }>(`/api/milestones/${milestoneId}`, { method: "DELETE" }),

  start: (milestoneId: string) =>
    apiFetch<Milestone>(`/api/milestones/${milestoneId}/start`, { method: "POST" }),

  submit: (milestoneId: string, body?: { note?: string; attachmentUrl?: string }) =>
    apiFetch<Milestone>(`/api/milestones/${milestoneId}/submit`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  approve: (milestoneId: string) =>
    apiFetch<Milestone>(`/api/milestones/${milestoneId}/approve`, { method: "POST" }),

  requestRevision: (milestoneId: string, body: { note: string }) =>
    apiFetch<Milestone>(`/api/milestones/${milestoneId}/request-revision`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export function getMilestoneStatusLabel(status: MilestoneStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "funded":
      return "Funded";
    case "in_progress":
      return "In progress";
    case "submitted":
      return "Submitted";
    case "revision_requested":
      return "Revision requested";
    case "approved":
      return "Approved";
    case "released":
      return "Released";
    case "disputed":
      return "Disputed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function formatMilestoneAmount(milestone: Milestone) {
  const symbol = milestone.currency === "USD" ? "$" : milestone.currency;
  return `${symbol}${milestone.amount}`;
}
