import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class InvoicesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InvoicesApiError";
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
    throw new InvoicesApiError(error.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "void" | "overdue";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  contractId: string | null;
  milestoneId: string | null;
  paymentId: string | null;
  billedToUserId: string;
  billedFromUserId: string | null;
  status: InvoiceStatus;
  subtotal: string;
  platformFee: string;
  total: string;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  contractTitle: string | null;
  milestoneTitle: string | null;
  billedToName: string;
  billedFromName: string | null;
  direction: "payable" | "receivable";
};

export type InvoiceListResponse = {
  items: InvoiceListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const invoicesApi = {
  list: (params?: { page?: number; limit?: number; status?: InvoiceStatus }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiFetch<InvoiceListResponse>(`/api/invoices${qs ? `?${qs}` : ""}`);
  },

  getHtmlUrl: (invoiceId: string) => `${API_BASE}/api/invoices/${invoiceId}/html`,
};

export function formatInvoiceAmount(amount: string, currency: string) {
  return currency === "USD" ? `$${amount}` : `${currency} ${amount}`;
}

export function getInvoiceStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "Paid";
    case "issued":
      return "Issued";
    case "draft":
      return "Draft";
    case "void":
      return "Void";
    case "overdue":
      return "Overdue";
    default:
      return status;
  }
}
