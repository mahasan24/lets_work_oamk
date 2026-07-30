import { env } from "@lets_work/env/web";

const API_BASE = env.VITE_SERVER_URL;

export class ChatApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatApiError";
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
    throw new ChatApiError(error.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export type ChatUser = {
  userId: string;
  name: string;
  image: string | null;
};

export type ChatAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string | null;
  attachments: ChatAttachment[];
};

export type ChatConversation = {
  id: string;
  jobId: string | null;
  contractId: string | null;
  updatedAt: string | null;
  lastReadAt: string | null;
  unreadCount: number;
  participant: ChatUser | null;
  lastMessage: {
    id: string;
    senderId: string;
    body: string | null;
    createdAt: string | null;
    readAt: string | null;
    editedAt: string | null;
    deletedAt: string | null;
  } | null;
};

type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const chatApi = {
  listConversations: (query?: {
    page?: number;
    limit?: number;
    search?: string;
    unreadOnly?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (query?.page) search.set("page", String(query.page));
    if (query?.limit) search.set("limit", String(query.limit));
    if (query?.search?.trim()) search.set("search", query.search.trim());
    if (query?.unreadOnly) search.set("unreadOnly", "true");
    const qs = search.toString();
    return apiFetch<Paginated<ChatConversation>>(`/api/chat/conversations${qs ? `?${qs}` : ""}`);
  },

  createOrGetConversation: (input: {
    participantUserId: string;
    jobId?: string | null;
    contractId?: string | null;
  }) =>
    apiFetch<{
      id: string;
      jobId: string | null;
      contractId: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      participants: ChatUser[];
    }>("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getConversation: (conversationId: string) =>
    apiFetch<{
      id: string;
      jobId: string | null;
      contractId: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      participants: ChatUser[];
    }>(`/api/chat/conversations/${conversationId}`),

  listMessages: (conversationId: string, query?: { page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (query?.page) search.set("page", String(query.page));
    if (query?.limit) search.set("limit", String(query.limit));
    const qs = search.toString();
    return apiFetch<Paginated<ChatMessage>>(
      `/api/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
    );
  },

  sendMessage: (
    conversationId: string,
    input: {
      body?: string | null;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        mimeType?: string | null;
        sizeBytes?: number | null;
      }>;
    },
  ) =>
    apiFetch<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  markRead: (conversationId: string) =>
    apiFetch<{ conversationId: string; readAt: string }>(
      `/api/chat/conversations/${conversationId}/read`,
      { method: "POST" },
    ),

  editMessage: (conversationId: string, messageId: string, body: string) =>
    apiFetch<ChatMessage>(`/api/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }),

  deleteMessage: (conversationId: string, messageId: string) =>
    apiFetch<ChatMessage>(`/api/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
    }),
};
