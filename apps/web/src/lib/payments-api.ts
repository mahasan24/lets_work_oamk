import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class PaymentsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentsApiError";
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
    throw new PaymentsApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type PaymentStatus = "pending" | "held" | "succeeded" | "refunded" | "failed";

export type PayoutStatus =
  "awaiting_funding" | "in_escrow" | "awaiting_payout" | "paid_out" | "refunded" | "failed";

export type PaymentView = {
  id: string;
  contractId: string | null;
  milestoneId: string | null;
  payerUserId: string;
  payeeUserId: string | null;
  status: PaymentStatus;
  payoutStatus: PayoutStatus;
  amount: string;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentListItem = PaymentView & {
  milestoneTitle: string | null;
  contractTitle: string | null;
  payerName: string;
  payeeName: string | null;
  direction: "in" | "out";
};

export type PaymentListResponse = {
  items: PaymentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    awaitingPayout: number;
    inEscrow: number;
    paidOut: number;
  };
};

export type FundMilestoneResponse = {
  paymentId: string;
  checkoutUrl: string;
  checkoutSessionId: string;
};

export type CheckoutSessionSummary = {
  checkoutSessionId: string;
  paymentStatus: string;
  contractId: string | null;
  payment: PaymentView | null;
};

export type ConnectAccountView = {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  readyForPayouts: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConnectStatusResponse =
  { connected: false; account: null } | { connected: true; account: ConnectAccountView };

export type ConnectOnboardResponse = {
  account: ConnectAccountView;
  onboardingUrl: string;
};

export type TransferPendingResponse = {
  transferredCount: number;
  transferredPaymentIds: string[];
  failed: Array<{ paymentId: string; error: string }>;
  account: ConnectAccountView;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const paymentsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    role?: "payer" | "payee";
  }) =>
    apiFetch<PaymentListResponse>(
      `/api/payments/${toQuery({
        page: params?.page,
        limit: params?.limit,
        status: params?.status,
        role: params?.role,
      })}`,
    ),

  fundMilestone: (milestoneId: string) =>
    apiFetch<FundMilestoneResponse>(`/api/payments/milestones/${milestoneId}/fund`, {
      method: "POST",
    }),

  getCheckoutSession: (sessionId: string) =>
    apiFetch<CheckoutSessionSummary>(`/api/payments/checkout/${sessionId}`),

  getPayment: (paymentId: string) => apiFetch<PaymentView>(`/api/payments/${paymentId}`),

  getConnectStatus: () => apiFetch<ConnectStatusResponse>("/api/payments/connect/status"),

  startConnectOnboarding: () =>
    apiFetch<ConnectOnboardResponse>("/api/payments/connect/onboard", { method: "POST" }),

  refreshConnectOnboarding: () =>
    apiFetch<ConnectOnboardResponse>("/api/payments/connect/refresh", { method: "POST" }),

  transferPending: () =>
    apiFetch<TransferPendingResponse>("/api/payments/connect/transfer-pending", {
      method: "POST",
    }),

  transferPayment: (paymentId: string) =>
    apiFetch<PaymentView>(`/api/payments/${paymentId}/transfer`, { method: "POST" }),
};

export function getPayoutStatusLabel(status: PayoutStatus) {
  switch (status) {
    case "awaiting_funding":
      return "Awaiting funding";
    case "in_escrow":
      return "In escrow";
    case "awaiting_payout":
      return "Awaiting payout";
    case "paid_out":
      return "Paid out";
    case "refunded":
      return "Refunded";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function formatPaymentAmount(payment: Pick<PaymentView, "amount" | "currency">) {
  const symbol = payment.currency === "USD" ? "$" : `${payment.currency} `;
  return `${symbol}${payment.amount}`;
}
