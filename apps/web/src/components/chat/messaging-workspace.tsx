import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Input } from "@lets_work/ui/components/input";
import { ScrollArea } from "@lets_work/ui/components/scroll-area";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  FileIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareIcon,
  PaperclipIcon,
  PencilIcon,
  SendIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  type ChatAttachment,
  type ChatConversation,
  type ChatMessage,
  chatApi,
} from "@/lib/chat-api";
import { uploadMessageAttachment } from "@/lib/cloudinary-upload";
import { emitRealtime, subscribeToRealtime } from "@/lib/realtime";

type MessagingWorkspaceProps = {
  basePath: "/dashboard/freelancer/messages" | "/dashboard/hirer/messages";
  conversationId: string | undefined;
  role: "freelancer" | "hirer";
};

type PendingAttachment = {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

function formatTimestamp(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactBytes(value: number | null | undefined) {
  if (!value || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(mimeType: string | null | undefined) {
  return Boolean(mimeType?.startsWith("image/"));
}

function AttachmentPreview({ attachment }: { attachment: ChatAttachment | PendingAttachment }) {
  const sizeLabel = compactBytes(attachment.sizeBytes);
  const isImage = isImageAttachment(attachment.mimeType);

  if (isImage) {
    return (
      <a
        href={attachment.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="group block overflow-hidden rounded-md border border-border bg-muted/30"
      >
        <img
          src={attachment.fileUrl}
          alt={attachment.fileName}
          className="max-h-48 w-full object-cover transition-opacity group-hover:opacity-90"
        />
        <span className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground">
          <ImageIcon className="size-3 shrink-0" />
          <span className="truncate">{attachment.fileName}</span>
          {sizeLabel ? <span className="shrink-0">· {sizeLabel}</span> : null}
        </span>
      </a>
    );
  }

  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs hover:bg-muted/50"
    >
      <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{attachment.fileName}</span>
      {sizeLabel ? <span className="shrink-0 text-muted-foreground">· {sizeLabel}</span> : null}
    </a>
  );
}

export function MessagingWorkspace({ basePath, conversationId, role }: MessagingWorkspaceProps) {
  const navigate = useNavigate({ from: basePath });
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUnreadOnly, setIsUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [typingByUserId, setTypingByUserId] = useState<Record<string, string>>({});
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const proposalsPath = role === "hirer" ? "/dashboard/hirer" : "/dashboard/freelancer/proposals";
  const contractsPath =
    role === "hirer" ? "/dashboard/hirer/contracts" : "/dashboard/freelancer/contracts";

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const result = await chatApi.listConversations({
        limit: 50,
        search: search.trim() || undefined,
        unreadOnly: isUnreadOnly || undefined,
      });
      setConversations(result.items);
      if (!conversationId && result.items.length > 0) {
        void navigate({
          search: (current) => ({ ...current, conversationId: result.items[0].id }),
          replace: true,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [conversationId, isUnreadOnly, navigate, search]);

  const loadMessages = useCallback(
    async (targetConversationId: string) => {
      setIsLoadingMessages(true);
      try {
        const [conversation, messageResult] = await Promise.all([
          chatApi.getConversation(targetConversationId),
          chatApi.listMessages(targetConversationId, { limit: 100 }),
        ]);
        setMessages(messageResult.items);
        const otherParticipant =
          conversation.participants.find((participant) => participant.userId !== currentUserId) ??
          conversation.participants[0] ??
          null;
        setActiveConversation(
          conversations.find((entry) => entry.id === targetConversationId) ?? {
            id: conversation.id,
            jobId: conversation.jobId,
            contractId: conversation.contractId,
            updatedAt: conversation.updatedAt,
            lastReadAt: null,
            unreadCount: 0,
            participant: otherParticipant,
            lastMessage: null,
          },
        );
        await chatApi.markRead(targetConversationId);
        setConversations((current) =>
          current.map((entry) =>
            entry.id === targetConversationId ? { ...entry, unreadCount: 0 } : entry,
          ),
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load messages");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [conversations, currentUserId],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setActiveConversation(null);
      setEditingMessageId(null);
      setComposer("");
      setPendingAttachments([]);
      return;
    }
    void loadMessages(conversationId);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, conversationId]);

  useEffect(() => {
    return subscribeToRealtime("chat:message:new", (payload) => {
      const incoming = payload as ChatMessage;
      if (!incoming?.id || !incoming.conversationId) return;

      const isActive = conversationId === incoming.conversationId;
      const isOwn = Boolean(currentUserId && incoming.senderId === currentUserId);

      setConversations((current) =>
        current.map((entry) =>
          entry.id === incoming.conversationId
            ? {
                ...entry,
                updatedAt: incoming.createdAt,
                unreadCount: isActive || isOwn ? 0 : entry.unreadCount + 1,
                lastMessage: {
                  id: incoming.id,
                  senderId: incoming.senderId,
                  body: incoming.body,
                  createdAt: incoming.createdAt,
                  readAt: incoming.readAt,
                  editedAt: incoming.editedAt,
                  deletedAt: incoming.deletedAt,
                },
              }
            : entry,
        ),
      );

      if (isActive) {
        setMessages((current) =>
          current.some((entry) => entry.id === incoming.id) ? current : [...current, incoming],
        );
        if (!isOwn) {
          void chatApi.markRead(incoming.conversationId).catch(() => undefined);
        }
      }
    });
  }, [conversationId, currentUserId]);

  useEffect(() => {
    return subscribeToRealtime("chat:message:updated", (payload) => {
      const incoming = payload as ChatMessage;
      if (!incoming?.id || !incoming.conversationId) return;
      if (conversationId === incoming.conversationId) {
        setMessages((current) =>
          current.map((entry) => (entry.id === incoming.id ? { ...entry, ...incoming } : entry)),
        );
      }
      setConversations((current) =>
        current.map((entry) =>
          entry.lastMessage?.id === incoming.id
            ? {
                ...entry,
                lastMessage: {
                  id: incoming.id,
                  senderId: incoming.senderId,
                  body: incoming.body,
                  createdAt: incoming.createdAt,
                  readAt: incoming.readAt,
                  editedAt: incoming.editedAt,
                  deletedAt: incoming.deletedAt,
                },
              }
            : entry,
        ),
      );
    });
  }, [conversationId]);

  useEffect(() => {
    return subscribeToRealtime("chat:conversation:read", (payload) => {
      const incoming = payload as { conversationId: string; userId: string; readAt: string };
      if (!incoming?.conversationId) return;
      if (incoming.conversationId !== conversationId) return;
      if (currentUserId && incoming.userId === currentUserId) return;
      setMessages((current) =>
        current.map((entry) =>
          entry.senderId === currentUserId && !entry.readAt
            ? { ...entry, readAt: incoming.readAt }
            : entry,
        ),
      );
    });
  }, [conversationId, currentUserId]);

  useEffect(() => {
    return subscribeToRealtime("chat:typing", (payload) => {
      const incoming = payload as {
        conversationId?: string;
        userId?: string;
        isTyping?: boolean;
      };
      if (!incoming.conversationId || !incoming.userId) return;
      if (incoming.conversationId !== conversationId) return;
      if (currentUserId && incoming.userId === currentUserId) return;
      const typingUserId = incoming.userId;
      setTypingByUserId((current) => {
        const next = { ...current };
        if (incoming.isTyping) {
          next[typingUserId] = new Date().toISOString();
        } else {
          delete next[typingUserId];
        }
        return next;
      });
    });
  }, [conversationId, currentUserId]);

  const typingParticipant = useMemo(() => {
    if (!activeConversation?.participant) return null;
    if (!typingByUserId[activeConversation.participant.userId]) return null;
    return activeConversation.participant;
  }, [activeConversation, typingByUserId]);

  const handleSelectConversation = async (targetConversationId: string) => {
    setEditingMessageId(null);
    setComposer("");
    setPendingAttachments([]);
    await navigate({
      search: (current) => ({ ...current, conversationId: targetConversationId }),
      replace: true,
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: PendingAttachment[] = [];
      for (const file of files.slice(0, 5)) {
        const entry = await uploadMessageAttachment(file);
        uploaded.push(entry);
      }
      setPendingAttachments((current) => [...current, ...uploaded].slice(0, 5));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attachment upload failed");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setComposer("");
  };

  const handleSend = async () => {
    if (!conversationId) return;
    if (!composer.trim() && pendingAttachments.length === 0) return;

    setIsSending(true);
    try {
      if (editingMessageId) {
        const updated = await chatApi.editMessage(
          conversationId,
          editingMessageId,
          composer.trim(),
        );
        setMessages((current) =>
          current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
        );
        setEditingMessageId(null);
      } else {
        const created = await chatApi.sendMessage(conversationId, {
          body: composer.trim() || null,
          attachments: pendingAttachments,
        });
        setMessages((current) => [...current, created]);
      }
      setComposer("");
      setPendingAttachments([]);
      emitRealtime({ type: "chat:typing", payload: { conversationId, isTyping: false } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!conversationId) return;
    try {
      const updated = await chatApi.deleteMessage(conversationId, messageId);
      setMessages((current) =>
        current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete message");
    }
  };

  const handleComposerChange = (value: string) => {
    setComposer(value);
    if (!conversationId || editingMessageId) return;
    emitRealtime({ type: "chat:typing", payload: { conversationId, isTyping: value.length > 0 } });

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      emitRealtime({ type: "chat:typing", payload: { conversationId, isTyping: false } });
    }, 1500);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const emptyListCopy = isUnreadOnly
    ? {
        title: "No unread conversations",
        body: "You're all caught up. Clear the unread filter to see your full inbox.",
      }
    : search.trim()
      ? {
          title: "No matching conversations",
          body: "Try a different name or message snippet.",
        }
      : {
          title: "No conversations yet",
          body:
            role === "hirer"
              ? "Message a shortlisted freelancer from a job's proposals, or open chat from an active contract."
              : "When a client messages you about a shortlisted proposal or contract, it will show up here.",
        };

  return (
    <div className="grid min-h-[70vh] grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="min-h-[70vh]">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Messages</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or message..."
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isUnreadOnly ? "default" : "outline"}
              onClick={() => setIsUnreadOnly((current) => !current)}
            >
              Unread
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadConversations()}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[62vh]">
            {isLoadingConversations ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-start gap-3 px-4 py-8">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <MessageSquareIcon className="size-5 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{emptyListCopy.title}</p>
                  <p className="text-xs text-muted-foreground">{emptyListCopy.body}</p>
                </div>
                {!isUnreadOnly && !search.trim() ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={proposalsPath}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      {role === "hirer" ? "View jobs" : "My proposals"}
                    </Link>
                    <Link
                      to={contractsPath}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Contracts
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((entry) => {
                  const hasUnread = entry.unreadCount > 0;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => void handleSelectConversation(entry.id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                          entry.id === conversationId && "bg-muted/60",
                        )}
                      >
                        <div className="relative mt-0.5">
                          <Avatar className="size-9">
                            <AvatarImage src={entry.participant?.image ?? undefined} />
                            <AvatarFallback>
                              {(entry.participant?.name ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {hasUnread ? (
                            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "truncate text-sm",
                                hasUnread ? "font-semibold text-foreground" : "font-medium",
                              )}
                            >
                              {entry.participant?.name ?? "Unknown user"}
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">
                                {formatTimestamp(entry.updatedAt)}
                              </span>
                              {hasUnread ? (
                                <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                                  {entry.unreadCount > 99 ? "99+" : entry.unreadCount}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <p
                            className={cn(
                              "mt-0.5 line-clamp-2 text-xs",
                              hasUnread
                                ? "font-medium text-foreground/80"
                                : "text-muted-foreground",
                            )}
                          >
                            {entry.lastMessage?.deletedAt
                              ? "Message deleted"
                              : (entry.lastMessage?.body ?? "Sent an attachment")}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="min-h-[70vh]">
        {conversationId ? (
          <>
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={activeConversation?.participant?.image ?? undefined} />
                    <AvatarFallback>
                      {(activeConversation?.participant?.name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {activeConversation?.participant?.name ?? "Conversation"}
                    </CardTitle>
                    {typingParticipant ? (
                      <p className="text-xs text-primary">Typing...</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {role === "freelancer" ? "Client chat" : "Freelancer chat"}
                      </p>
                    )}
                  </div>
                </div>
                {activeConversation?.contractId ? (
                  <Link
                    to={
                      role === "hirer"
                        ? "/dashboard/hirer/contracts/$contractId"
                        : "/dashboard/freelancer/contracts/$contractId"
                    }
                    params={{ contractId: activeConversation.contractId }}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    View contract
                  </Link>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="flex h-[62vh] flex-col p-0">
              <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {isLoadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <MessageSquareIcon className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Start the conversation</p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      Say hello, ask about timeline, or share a file to get things moving.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {messages.map((entry) => {
                      const isOwn = Boolean(currentUserId && entry.senderId === currentUserId);
                      const canModify = isOwn && !entry.deletedAt;
                      return (
                        <div
                          key={entry.id}
                          className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3 py-2",
                              isOwn
                                ? "rounded-br-md bg-primary text-primary-foreground"
                                : "rounded-bl-md border border-border bg-card",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p
                                className={cn(
                                  "text-[11px]",
                                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
                                )}
                              >
                                {formatTimestamp(entry.createdAt)}
                                {entry.editedAt && !entry.deletedAt ? " · Edited" : ""}
                              </p>
                              {canModify ? (
                                <div className="flex items-center gap-0.5">
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                                    onClick={() => {
                                      setEditingMessageId(entry.id);
                                      setComposer(entry.body ?? "");
                                      setPendingAttachments([]);
                                    }}
                                    aria-label="Edit message"
                                  >
                                    <PencilIcon className="size-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                                    onClick={() => void handleDeleteMessage(entry.id)}
                                    aria-label="Delete message"
                                  >
                                    <TrashIcon className="size-3.5" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <p
                              className={cn(
                                "mt-1 whitespace-pre-wrap text-sm",
                                entry.deletedAt && "italic opacity-70",
                              )}
                            >
                              {entry.deletedAt ? "This message was deleted." : (entry.body ?? "")}
                            </p>
                            {!entry.deletedAt && entry.attachments.length > 0 ? (
                              <ul className="mt-2 space-y-2">
                                {entry.attachments.map((attachment) => (
                                  <li key={attachment.id}>
                                    <AttachmentPreview attachment={attachment} />
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            {isOwn && !entry.deletedAt ? (
                              <p className="mt-1 text-right text-[10px] text-primary-foreground/65">
                                {entry.readAt ? "Read" : "Sent"}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border px-4 py-3">
                {editingMessageId ? (
                  <div className="mb-2 flex items-center justify-between rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                    <span className="font-medium">Editing message</span>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                ) : null}

                {pendingAttachments.length > 0 ? (
                  <ul className="mb-2 flex flex-wrap gap-2">
                    {pendingAttachments.map((attachment, index) => (
                      <li key={`${attachment.fileUrl}-${index}`}>
                        <Badge variant="secondary" className="gap-1">
                          {isImageAttachment(attachment.mimeType) ? (
                            <ImageIcon className="size-3" />
                          ) : (
                            <PaperclipIcon className="size-3" />
                          )}
                          <span className="max-w-32 truncate">{attachment.fileName}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAttachments((current) =>
                                current.filter((_, currentIndex) => currentIndex !== index),
                              )
                            }
                            className="ml-1 inline-flex"
                            aria-label="Remove attachment"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="flex items-end gap-2">
                  <textarea
                    value={composer}
                    onChange={(event) => handleComposerChange(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={
                      editingMessageId
                        ? "Update your message..."
                        : "Type your message... (Enter to send)"
                    }
                    className="min-h-20 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex flex-col gap-2">
                    {!editingMessageId ? (
                      <label
                        className={cn(
                          buttonVariants({ variant: "outline", size: "icon-sm" }),
                          "cursor-pointer",
                          isUploading && "pointer-events-none opacity-60",
                        )}
                      >
                        <PaperclipIcon className="size-4" />
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                      </label>
                    ) : null}
                    <Button
                      type="button"
                      size="icon-sm"
                      onClick={() => void handleSend()}
                      disabled={
                        isSending ||
                        isUploading ||
                        (!composer.trim() && pendingAttachments.length === 0)
                      }
                    >
                      {isSending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <SendIcon className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex h-[62vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <MessageSquareIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Choose someone from the list, or start a chat from a proposal or contract.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
