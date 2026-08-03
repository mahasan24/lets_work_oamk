import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class ReviewsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReviewsApiError";
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
    throw new ReviewsApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type Review = {
  id: string;
  contractId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string; image: string | null } | null;
};

export type ContractReviewsResponse = {
  items: Review[];
  myReview: Review | null;
  counterpartReview: Review | null;
  canReview: boolean;
  revieweeUserId: string;
};

export type PublicReviewsResponse = {
  items: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const reviewsApi = {
  listForContract: (contractId: string) =>
    apiFetch<ContractReviewsResponse>(`/api/contracts/${contractId}/reviews`),

  create: (contractId: string, body: { rating: number; comment?: string; isPublic?: boolean }) =>
    apiFetch<Review>(`/api/contracts/${contractId}/reviews`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listForFreelancer: (userId: string, params?: { page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const qs = search.toString();
    return apiFetch<PublicReviewsResponse>(
      `/api/freelancers/${encodeURIComponent(userId)}/reviews${qs ? `?${qs}` : ""}`,
    );
  },
};
