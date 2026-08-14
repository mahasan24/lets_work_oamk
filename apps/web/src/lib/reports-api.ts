import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class ReportsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReportsApiError";
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
    throw new ReportsApiError(error.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export type ReportType = "spam" | "fraud" | "harassment" | "abuse" | "other";

export type ReportStatus = "open" | "under_review" | "resolved" | "dismissed";

export type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string | null;
  reportedJobId: string | null;
  reportedProposalId: string | null;
  reportedMessageId: string | null;
  reportType: ReportType;
  description: string;
  status: ReportStatus;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportInput = {
  reportType: ReportType;
  description: string;
  reportedUserId?: string | null;
  reportedJobId?: string | null;
  reportedProposalId?: string | null;
  reportedMessageId?: string | null;
};

export const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "spam", label: "Spam or misleading" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "harassment", label: "Harassment" },
  { value: "abuse", label: "Abuse or inappropriate content" },
  { value: "other", label: "Other" },
];

export const reportsApi = {
  create: (body: CreateReportInput) =>
    apiFetch<Report>("/api/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listMine: (params?: { page?: number; limit?: number; status?: ReportStatus }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiFetch<{
      items: Report[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/reports${qs ? `?${qs}` : ""}`);
  },
};
