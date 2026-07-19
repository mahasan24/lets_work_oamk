import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class ContractsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ContractsApiError";
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
    throw new ContractsApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type ContractStatus = "draft" | "active" | "completed" | "cancelled";
export type ContractType = "hourly" | "one_time";

export type ContractParty = {
  id: string;
  name: string;
  image: string | null;
};

export type Contract = {
  id: string;
  jobId: string | null;
  proposalId: string | null;
  hirerUserId: string;
  freelancerUserId: string;
  title: string;
  scope: string;
  contractType: ContractType;
  status: ContractStatus;
  hourlyRate: string | null;
  fixedAmount: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    slug: string | null;
    currency: string;
  } | null;
  hirer: ContractParty;
  freelancer: ContractParty;
};

export type ContractListResponse = {
  items: Contract[];
  meta: { total: number };
};

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const contractsApi = {
  list: (query?: { status?: ContractStatus; role?: "hirer" | "freelancer" }) =>
    apiFetch<ContractListResponse>(
      `/api/contracts${buildQuery({
        status: query?.status,
        role: query?.role,
      })}`,
    ),

  get: (contractId: string) => apiFetch<Contract>(`/api/contracts/${contractId}`),

  complete: (contractId: string) =>
    apiFetch<Contract>(`/api/contracts/${contractId}/complete`, { method: "POST" }),

  cancel: (contractId: string) =>
    apiFetch<Contract>(`/api/contracts/${contractId}/cancel`, { method: "POST" }),
};

export function getContractStatusLabel(status: ContractStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function formatContractRate(contract: Contract) {
  const currency = contract.job?.currency ?? "USD";
  const symbol = currency === "USD" ? "$" : currency;
  if (contract.contractType === "hourly") {
    return contract.hourlyRate ? `${symbol}${contract.hourlyRate}/hr` : "Not set";
  }
  return contract.fixedAmount ? `${symbol}${contract.fixedAmount}` : "Not set";
}
