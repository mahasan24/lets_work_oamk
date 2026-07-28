import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Input } from "@lets_work/ui/components/input";
import { ScrollArea } from "@lets_work/ui/components/scroll-area";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2Icon, PaperclipIcon, PencilIcon, SendIcon, TrashIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { type ChatConversation, type ChatMessage, chatApi } from "@/lib/chat-api";
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

export function MessagingWorkspace({ basePath, conversationId, role }: MessagingWorkspaceProps) {
  const navigate = useNavigate({ from: basePath });
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
        setActiveConversation(
          conversations.find((entry) => entry.id === targetConversationId) ?? {
            id: conversation.id,
            jobId: conversation.jobId,
            contractId: conversation.contractId,
            updatedAt: conversation.updatedAt,
            lastReadAt: null,
            unreadCount: 0,
            participant:
              conversation.participants.find((participant) => participant.userId !== "") ?? null,
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
    [conversations],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setActiveConversation(null);
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
      setConversations((current) =>
        current.map((entry) =>
          entry.id === incoming.conversationId
            ? {
                ...entry,
                updatedAt: incoming.createdAt,
                unreadCount:
                  conversationId === incoming.conversationId
                    ? 0
                    : entry.unreadCount + (incoming.senderId ? 1 : 0),
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
      if (conversationId === incoming.conversationId) {
        setMessages((current) =>
          current.some((entry) => entry.id === incoming.id) ? current : [...current, incoming],
        );
      }
    });
  }, [conversationId]);

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
      setMessages((current) =>
        current.map((entry) => (entry.readAt ? entry : { ...entry, readAt: incoming.readAt })),
      );
    });
  }, [conversationId]);

  useEffect(() => {
    return subscribeToRealtime("chat:typing", (payload) => {
      const incoming = payload as {
        conversationId?: string;
        userId?: string;
        isTyping?: boolean;
      };
      if (!incoming.conversationId || !incoming.userId) return;
      if (incoming.conversationId !== conversationId) return;
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
  }, [conversationId]);

  const typingParticipant = useMemo(() => {
    if (!activeConversation?.participant) return null;
    if (!typingByUserId[activeConversation.participant.userId]) return null;
    return activeConversation.participant;
  }, [activeConversation, typingByUserId]);

  const handleSelectConversation = async (targetConversationId: string) => {
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
    if (!conversationId) return;
    emitRealtime({ type: "chat:typing", payload: { conversationId, isTyping: value.length > 0 } });

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      emitRealtime({ type: "chat:typing", payload: { conversationId, isTyping: false } });
    }, 1500);
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
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No conversations yet. Start from a proposal or contract workflow.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelectConversation(entry.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        entry.id === conversationId && "bg-muted/60",
                      )}
                    >
                      <Avatar className="mt-0.5 size-9">
                        <AvatarImage src={entry.participant?.image ?? undefined} />
                        <AvatarFallback>
                          {(entry.participant?.name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {entry.participant?.name ?? "Unknown user"}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatTimestamp(entry.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {entry.lastMessage?.deletedAt
                            ? "Message deleted"
                            : (entry.lastMessage?.body ?? "Sent an attachment")}
                        </p>
                        {entry.unreadCount > 0 ? (
                          <Badge variant="secondary" className="mt-1">
                            {entry.unreadCount} unread
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
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
                      <p className="text-xs text-muted-foreground">Typing...</p>
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
                  <div className="text-sm text-muted-foreground">
                    No messages yet. Send the first message to start this conversation.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {messages.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(entry.createdAt)}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMessageId(entry.id);
                                setComposer(entry.body ?? "");
                              }}
                              aria-label="Edit message"
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => void handleDeleteMessage(entry.id)}
                              aria-label="Delete message"
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "mt-1 text-sm",
                            entry.deletedAt && "italic text-muted-foreground",
                          )}
                        >
                          {entry.deletedAt
                            ? "This message was deleted."
                            : (entry.body ?? "(Attachment only)")}
                        </p>
                        {entry.attachments.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {entry.attachments.map((attachment) => (
                              <li key={attachment.id}>
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
                                >
                                  <PaperclipIcon className="size-3.5" />
                                  {attachment.fileName}
                                  {attachment.sizeBytes
                                    ? ` · ${compactBytes(attachment.sizeBytes)}`
                                    : ""}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border px-4 py-3">
                {pendingAttachments.length > 0 ? (
                  <ul className="mb-2 flex flex-wrap gap-2">
                    {pendingAttachments.map((attachment, index) => (
                      <li key={`${attachment.fileUrl}-${index}`}>
                        <Badge variant="secondary" className="gap-1">
                          <PaperclipIcon className="size-3" />
                          {attachment.fileName}
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAttachments((current) =>
                                current.filter((_, currentIndex) => currentIndex !== index),
                              )
                            }
                            className="ml-1 inline-flex"
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
                    placeholder="Type your message..."
                    className="min-h-20 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex flex-col gap-2">
                    <label
                      className={cn(
                        buttonVariants({ variant: "outline", size: "icon-sm" }),
                        "cursor-pointer",
                        isUploading && "pointer-events-none opacity-60",
                      )}
                    >
                      <PaperclipIcon className="size-4" />
                      <input type="file" multiple className="hidden" onChange={handleFileSelect} />
                    </label>
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
          <CardContent className="flex h-[62vh] items-center justify-center text-sm text-muted-foreground">
            Select a conversation to open your messages.
          </CardContent>
        )}
      </Card>
    </div>
  );
}
