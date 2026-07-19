import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class NotificationsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NotificationsApiError";
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
    throw new NotificationsApiError(error.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type NotificationType =
  | "system"
  | "message"
  | "job"
  | "proposal"
  | "contract"
  | "payment"
  | "review"
  | "report";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  items: AppNotification[];
  meta: {
    unreadCount: number;
    total: number;
  };
};

export const notificationsApi = {
  list: (query?: { unreadOnly?: boolean; limit?: number }) => {
    const search = new URLSearchParams();
    if (query?.unreadOnly) search.set("unreadOnly", "true");
    if (query?.limit) search.set("limit", String(query.limit));
    const qs = search.toString();
    return apiFetch<NotificationListResponse>(`/api/notifications${qs ? `?${qs}` : ""}`);
  },

  unreadCount: () => apiFetch<{ unreadCount: number }>("/api/notifications/unread-count"),

  markRead: (id: string) =>
    apiFetch<AppNotification>(`/api/notifications/${id}/read`, { method: "POST" }),

  markAllRead: () =>
    apiFetch<{ unreadCount: number }>("/api/notifications/read-all", { method: "POST" }),
};
