import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

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
    throw new Error(error.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export type AvailabilityStatus = "available" | "limited" | "unavailable";
export type AccountType = "freelancer" | "hirer" | "both";
export type ActiveRole = "freelancer" | "hirer";
export type HirerType = "individual" | "company";
export type OnboardingStep = "profile" | "role_selection" | "verification" | "complete";
export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

export type ProfileBundle = {
  user: { id: string; name: string; email: string; image: string | null };
  profile: {
    userId: string;
    accountType: AccountType;
    activeRole: ActiveRole;
    onboardingStep: OnboardingStep;
    headline: string | null;
    bio: string | null;
    skills: string[] | null;
    jobCategories: string[] | null;
    hirerType: HirerType | null;
    companyName: string | null;
    companyWebsite: string | null;
    companyDescription: string | null;
    companySize: string | null;
    phoneNumber: string | null;
    hourlyRate: string | null;
    currency: string;
    country: string | null;
    city: string | null;
    location: string | null;
    timezone: string | null;
    videoIntroUrl: string | null;
    avatarUrl: string | null;
    availabilityStatus: AvailabilityStatus;
    hoursPerWeek: number | null;
    profileCompletion: number;
  };
  portfolio: Array<{
    id: string;
    title: string;
    description: string | null;
    projectUrl: string | null;
    imageUrl: string | null;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string | null;
    credentialId: string | null;
    credentialUrl: string | null;
    imageUrl: string | null;
    issueDate: string | null;
    expiryDate: string | null;
  }>;
  experience: Array<{
    id: string;
    title: string;
    company: string | null;
    description: string | null;
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
  }>;
  verifications: Array<{
    id: string;
    type: string;
    status: VerificationStatus;
    label: string | null;
  }>;
  profileCompletion: number;
};

export type UploadSignature = {
  timestamp: number;
  signature: string;
  folder: string;
  cloudName: string;
  apiKey: string;
};

export const profileApi = {
  getMe: () => apiFetch<ProfileBundle>("/api/profile/me"),
  initialize: (accountType: "hirer" | "freelancer") =>
    apiFetch<ProfileBundle>("/api/profile/initialize", {
      method: "POST",
      body: JSON.stringify({ accountType }),
    }),
  updateMe: (body: Record<string, unknown>) =>
    apiFetch<ProfileBundle>("/api/profile/me", { method: "PATCH", body: JSON.stringify(body) }),
  submitVerification: () =>
    apiFetch<ProfileBundle>("/api/profile/verification", { method: "POST" }),
  addPortfolio: (body: Record<string, unknown>) =>
    apiFetch<ProfileBundle>("/api/profile/portfolio", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deletePortfolio: (id: string) =>
    apiFetch<ProfileBundle>(`/api/profile/portfolio/${id}`, { method: "DELETE" }),
  addCertification: (body: Record<string, unknown>) =>
    apiFetch<ProfileBundle>("/api/profile/certifications", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteCertification: (id: string) =>
    apiFetch<ProfileBundle>(`/api/profile/certifications/${id}`, { method: "DELETE" }),
  addExperience: (body: Record<string, unknown>) =>
    apiFetch<ProfileBundle>("/api/profile/experience", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteExperience: (id: string) =>
    apiFetch<ProfileBundle>(`/api/profile/experience/${id}`, { method: "DELETE" }),
  getUploadSignature: (folder: string) =>
    apiFetch<UploadSignature>(`/api/profile/uploads/sign?folder=${folder}`),
};
