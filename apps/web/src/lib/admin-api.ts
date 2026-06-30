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
  };
};

export const adminApi = {
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
};
