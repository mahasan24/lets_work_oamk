import { env } from "@lets_work/env/web";

import type { AvailabilityStatus, HirerType } from "./profile-api";

const API_BASE = env.VITE_SERVER_URL;

export class PublicProfilesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicProfilesApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new PublicProfilesApiError(error.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export type FreelancerSort = "recommended" | "rating" | "rate_low" | "rate_high" | "newest";

export type FreelancerSearchQuery = {
  search?: string;
  skills?: string[];
  country?: string;
  availability?: AvailabilityStatus;
  minRate?: string;
  maxRate?: string;
  minRating?: string;
  sort?: FreelancerSort;
  page?: number;
  limit?: number;
};

export type FreelancerCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  hourlyRate: string | null;
  currency: string;
  country: string | null;
  city: string | null;
  availabilityStatus: AvailabilityStatus;
  hoursPerWeek: number | null;
  avgRating: string | null;
  reviewCount: number;
  jobsCompleted: number;
  reputationScore: number;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type FreelancerSearchResponse = {
  items: FreelancerCard[];
  pagination: Pagination;
};

export type PublicPortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  projectUrl: string | null;
  imageUrl: string | null;
};

export type PublicCertification = {
  id: string;
  name: string;
  issuer: string | null;
  credentialUrl: string | null;
  imageUrl: string | null;
  issueDate: string | null;
  expiryDate: string | null;
};

export type PublicExperience = {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
};

export type PublicFreelancerProfile = FreelancerCard & {
  timezone: string | null;
  videoIntroUrl: string | null;
  memberSince: string;
  identityVerified: boolean;
  portfolio: PublicPortfolioItem[];
  certifications: PublicCertification[];
  experience: PublicExperience[];
};

export type PublicClientProfile = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  hirerType: HirerType | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  companySize: string | null;
  jobCategories: string[];
  country: string | null;
  city: string | null;
  timezone: string | null;
  memberSince: string;
  identityVerified: boolean;
  openJobsCount: number;
};

function buildFreelancerQuery(query: FreelancerSearchQuery | undefined) {
  const search = new URLSearchParams();

  const scalars: Record<string, string | number | undefined> = {
    search: query?.search,
    country: query?.country,
    availability: query?.availability,
    minRate: query?.minRate,
    maxRate: query?.maxRate,
    minRating: query?.minRating,
    sort: query?.sort,
    page: query?.page,
    limit: query?.limit,
  };

  for (const [key, value] of Object.entries(scalars)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }

  for (const skill of query?.skills ?? []) {
    if (skill.trim()) search.append("skills", skill.trim());
  }

  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export const publicProfilesApi = {
  searchFreelancers: (query?: FreelancerSearchQuery) =>
    apiFetch<FreelancerSearchResponse>(`/api/freelancers${buildFreelancerQuery(query)}`),

  getFreelancer: (userId: string) =>
    apiFetch<PublicFreelancerProfile>(`/api/freelancers/${encodeURIComponent(userId)}`),

  getClient: (userId: string) =>
    apiFetch<PublicClientProfile>(`/api/clients/${encodeURIComponent(userId)}`),
};
