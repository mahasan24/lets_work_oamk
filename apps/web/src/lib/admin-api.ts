import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
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
    throw new AdminApiError(error.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export type PendingVerification = {
  id: string;
  userId: string;
  type: string;
  status: string;
  label: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    accountType: string | null;
    activeRole: string | null;
    profileCompletion: number | null;
    headline: string | null;
    companyName: string | null;
    hirerType: string | null;
    country: string | null;
    city: string | null;
  };
};

export type AdminOverview = {
  users: {
    total: number;
    last7Days: number;
    last30Days: number;
    freelancers: number;
    hirers: number;
    suspended: number;
  };
  jobs: { total: number; open: number };
  proposals: { total: number };
  contracts: { total: number; active: number; disputed: number };
  disputes: { open: number };
  verifications: { pending: number };
  payments: {
    heldCount: number;
    succeededCount: number;
    volumeUsd: number;
    escrowHeldUsd: number;
  };
  generatedAt: string;
};

export type AdminDispute = {
  id: string;
  contractId: string;
  milestoneId: string | null;
  openedByUserId: string;
  respondentUserId: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contractTitle: string;
  contractStatus: string;
  hirerUserId: string;
  freelancerUserId: string;
  milestoneTitle: string | null;
  openedByName: string;
  openedByEmail: string;
  respondentName: string;
  respondentEmail: string;
};

export type AdminUserSearchResult = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  accountType: string | null;
  activeRole: string | null;
  onboardingStep: string | null;
  profileCompletion: number | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  platformRole: string | null;
  identityStatus: string | null;
};

export const adminApi = {
  getMe: () =>
    apiFetch<{
      isAdmin: boolean;
      platformRole: string | null;
      suspendedAt: string | null;
      suspendReason: string | null;
    }>("/api/admin/me"),

  getOverview: () => apiFetch<AdminOverview>("/api/admin/overview"),

  listPendingVerifications: () =>
    apiFetch<{ items: PendingVerification[] }>("/api/admin/verifications"),

  approveVerification: (id: string) =>
    apiFetch<{ id: string; userId: string; status: string }>(
      `/api/admin/verifications/${id}/approve`,
      { method: "POST" },
    ),

  rejectVerification: (id: string, reason?: string) =>
    apiFetch<{ id: string; userId: string; status: string; reason: string | null }>(
      `/api/admin/verifications/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    ),

  listDisputes: (params?: { page?: number; limit?: number; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiFetch<{ items: AdminDispute[]; pagination: { page: number; total: number } }>(
      `/api/admin/disputes${qs ? `?${qs}` : ""}`,
    );
  },

  markDisputeUnderReview: (id: string) =>
    apiFetch(`/api/admin/disputes/${id}/under-review`, { method: "POST" }),

  resolveDispute: (
    id: string,
    body: {
      resolutionStatus: "resolved_client" | "resolved_freelancer" | "closed";
      resolution: string;
      restoreContractStatus?: "active" | "paused" | "cancelled" | "completed";
    },
  ) =>
    apiFetch(`/api/admin/disputes/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  searchUsers: (q: string) =>
    apiFetch<{ items: AdminUserSearchResult[] }>(
      `/api/admin/users/search?q=${encodeURIComponent(q)}`,
    ),

  suspendUser: (id: string, reason?: string) =>
    apiFetch(`/api/admin/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  unsuspendUser: (id: string) => apiFetch(`/api/admin/users/${id}/unsuspend`, { method: "POST" }),
};
