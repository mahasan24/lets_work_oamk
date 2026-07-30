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

export type PaymentView = {
  id: string;
  contractId: string | null;
  milestoneId: string | null;
  payerUserId: string;
  payeeUserId: string | null;
  status: "pending" | "held" | "succeeded" | "refunded" | "failed";
  amount: string;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export const paymentsApi = {
  fundMilestone: (milestoneId: string) =>
    apiFetch<FundMilestoneResponse>(`/api/payments/milestones/${milestoneId}/fund`, {
      method: "POST",
    }),

  getCheckoutSession: (sessionId: string) =>
    apiFetch<CheckoutSessionSummary>(`/api/payments/checkout/${sessionId}`),

  getPayment: (paymentId: string) => apiFetch<PaymentView>(`/api/payments/${paymentId}`),
};
