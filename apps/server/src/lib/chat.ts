import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import {
  conversation,
  conversationParticipant,
  message,
  messageAttachment,
} from "@lets_work/db/schema/chat";
import { contract } from "@lets_work/db/schema/contracts";
import { job, proposal } from "@lets_work/db/schema/jobs";
import { marketplaceUserProfile } from "@lets_work/db/schema/marketplace";
import { and, desc, eq, inArray, isNotNull, ne, or, sql, type InferSelectModel } from "drizzle-orm";

import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import { createNotifications } from "./notifications";
import { publishToUser, type RealtimeEvent } from "./realtime";

type MessageRow = InferSelectModel<typeof message>;
type AttachmentRow = InferSelectModel<typeof messageAttachment>;

export type ChatAttachmentInput = {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type ChatListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  unreadOnly?: boolean;
};

export type MessageListQuery = {
  page?: number;
  limit?: number;
};

export class ConversationNotFoundError extends NotFoundError {
  constructor() {
    super("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
}

export class MessageNotFoundError extends NotFoundError {
  constructor() {
    super("Message not found", "MESSAGE_NOT_FOUND");
  }
}

export class ChatAccessError extends ForbiddenError {
  constructor() {
    super("You do not have access to this conversation", "CHAT_FORBIDDEN");
  }
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function serializeAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: toIso(row.createdAt),
  };
}

function buildAttachmentMap(rows: AttachmentRow[]) {
  const map = new Map<string, ReturnType<typeof serializeAttachment>[]>();
  for (const row of rows) {
    const list = map.get(row.messageId) ?? [];
    list.push(serializeAttachment(row));
    map.set(row.messageId, list);
  }
  return map;
}

function serializeMessage(
  row: MessageRow,
  attachments: ReturnType<typeof serializeAttachment>[] = [],
) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.deletedAt ? null : row.body,
    readAt: toIso(row.readAt),
    editedAt: toIso(row.editedAt),
    deletedAt: toIso(row.deletedAt),
    createdAt: toIso(row.createdAt),
    attachments,
  };
}

async function getConversationParticipants(conversationId: string) {
  return db
    .select({
      userId: conversationParticipant.userId,
      name: user.name,
      image: user.image,
    })
    .from(conversationParticipant)
    .innerJoin(user, eq(user.id, conversationParticipant.userId))
    .where(eq(conversationParticipant.conversationId, conversationId));
}

async function ensureParticipant(conversationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversationParticipant)
    .where(
      and(
        eq(conversationParticipant.conversationId, conversationId),
        eq(conversationParticipant.userId, userId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new ConversationNotFoundError();
  }
  return row;
}

async function hasDirectRelationship(userId: string, targetUserId: string) {
  const [sharedContract] = await db
    .select({ id: contract.id })
    .from(contract)
    .where(
      or(
        and(eq(contract.hirerUserId, userId), eq(contract.freelancerUserId, targetUserId)),
        and(eq(contract.hirerUserId, targetUserId), eq(contract.freelancerUserId, userId)),
      )!,
    )
    .limit(1);
  if (sharedContract) return true;

  const [sharedProposal] = await db
    .select({ id: proposal.id })
    .from(proposal)
    .innerJoin(job, eq(job.id, proposal.jobId))
    .where(
      or(
        and(eq(job.hirerUserId, userId), eq(proposal.freelancerUserId, targetUserId)),
        and(eq(job.hirerUserId, targetUserId), eq(proposal.freelancerUserId, userId)),
      )!,
    )
    .limit(1);

  return Boolean(sharedProposal);
}

async function assertMessageRelationship(
  userId: string,
  targetUserId: string,
  input?: { jobId?: string | null; contractId?: string | null },
) {
  if (userId === targetUserId) {
    throw new ValidationError(["Cannot create a conversation with yourself"], "Invalid recipient");
  }

  if (input?.contractId) {
    const [sharedContract] = await db
      .select({
        id: contract.id,
      })
      .from(contract)
      .where(
        and(
          eq(contract.id, input.contractId),
          or(
            and(eq(contract.hirerUserId, userId), eq(contract.freelancerUserId, targetUserId)),
            and(eq(contract.hirerUserId, targetUserId), eq(contract.freelancerUserId, userId)),
          )!,
        ),
      )
      .limit(1);
    if (!sharedContract) {
      throw new ChatAccessError();
    }
    return;
  }

  if (input?.jobId) {
    const [sharedJobProposal] = await db
      .select({ id: proposal.id })
      .from(proposal)
      .innerJoin(job, eq(job.id, proposal.jobId))
      .where(
        and(
          eq(job.id, input.jobId),
          or(
            and(eq(job.hirerUserId, userId), eq(proposal.freelancerUserId, targetUserId)),
            and(eq(job.hirerUserId, targetUserId), eq(proposal.freelancerUserId, userId)),
          )!,
        ),
      )
      .limit(1);

    if (!sharedJobProposal) {
      throw new ChatAccessError();
    }
    return;
  }

  const allowed = await hasDirectRelationship(userId, targetUserId);
  if (!allowed) {
    throw new ChatAccessError();
  }
}

function buildConversationPath(activeRole: "freelancer" | "hirer", conversationId: string) {
  return activeRole === "hirer"
    ? `/dashboard/hirer/messages?conversationId=${conversationId}`
    : `/dashboard/freelancer/messages?conversationId=${conversationId}`;
}

async function emitConversationEvent(
  conversationId: string,
  eventFactory: (toUserId: string) => RealtimeEvent,
) {
  const participants = await db
    .select({ userId: conversationParticipant.userId })
    .from(conversationParticipant)
    .where(eq(conversationParticipant.conversationId, conversationId));
  for (const participant of participants) {
    publishToUser(participant.userId, eventFactory(participant.userId));
  }
}

export async function listConversations(userId: string, query: ChatListQuery = {}) {
  const rows = await db
    .select({
      participant: conversationParticipant,
      conversation,
    })
    .from(conversationParticipant)
    .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
    .where(eq(conversationParticipant.userId, userId))
    .orderBy(desc(conversation.updatedAt));

  if (rows.length === 0) {
    return {
      items: [],
      pagination: buildPaginationMeta(1, query.limit ?? 20, 0),
    };
  }

  const conversationIds = rows.map((row) => row.conversation.id);

  const others = await db
    .select({
      conversationId: conversationParticipant.conversationId,
      userId: user.id,
      name: user.name,
      image: user.image,
    })
    .from(conversationParticipant)
    .innerJoin(user, eq(user.id, conversationParticipant.userId))
    .where(
      and(
        inArray(conversationParticipant.conversationId, conversationIds),
        ne(conversationParticipant.userId, userId),
      ),
    );

  const otherByConversation = new Map<string, (typeof others)[number]>();
  for (const row of others) {
    if (!otherByConversation.has(row.conversationId)) {
      otherByConversation.set(row.conversationId, row);
    }
  }

  const latestMessagesResult = await db.execute(sql<{
    id: string;
    conversationId: string;
    senderId: string;
    body: string | null;
    createdAt: Date;
    readAt: Date | null;
    editedAt: Date | null;
    deletedAt: Date | null;
  }>`
    select distinct on (m.conversation_id)
      m.id,
      m.conversation_id as "conversationId",
      m.sender_id as "senderId",
      m.body,
      m.created_at as "createdAt",
      m.read_at as "readAt",
      m.edited_at as "editedAt",
      m.deleted_at as "deletedAt"
    from message m
    where m.conversation_id in ${sql.join(
      conversationIds.map((id) => sql`${id}`),
      sql`, `,
    )}
    order by m.conversation_id, m.created_at desc
  `);

  const latestRows = latestMessagesResult.rows as Array<{
    id: string;
    conversationId: string;
    senderId: string;
    body: string | null;
    createdAt: Date;
    readAt: Date | null;
    editedAt: Date | null;
    deletedAt: Date | null;
  }>;
  const latestByConversation = new Map<string, (typeof latestRows)[number]>();
  for (const row of latestRows) {
    latestByConversation.set(row.conversationId, row);
  }

  const unreadResult = await db.execute(sql<{ conversationId: string; unreadCount: number }>`
    select
      cp.conversation_id as "conversationId",
      count(m.id)::int as "unreadCount"
    from conversation_participant cp
    join message m on m.conversation_id = cp.conversation_id
    where cp.user_id = ${userId}
      and m.sender_id <> ${userId}
      and m.deleted_at is null
      and (cp.last_read_at is null or m.created_at > cp.last_read_at)
      and cp.conversation_id in ${sql.join(
        conversationIds.map((id) => sql`${id}`),
        sql`, `,
      )}
    group by cp.conversation_id
  `);

  const unreadRows = unreadResult.rows as Array<{ conversationId: string; unreadCount: number }>;
  const unreadByConversation = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByConversation.set(row.conversationId, Number(row.unreadCount));
  }

  const items = rows
    .map(({ conversation: conversationRow, participant }) => {
      const other = otherByConversation.get(conversationRow.id);
      const latest = latestByConversation.get(conversationRow.id);
      const unreadCount = unreadByConversation.get(conversationRow.id) ?? 0;
      return {
        id: conversationRow.id,
        jobId: conversationRow.jobId,
        contractId: conversationRow.contractId,
        updatedAt: toIso(conversationRow.updatedAt),
        lastReadAt: toIso(participant.lastReadAt),
        unreadCount,
        participant: other
          ? {
              userId: other.userId,
              name: other.name,
              image: other.image,
            }
          : null,
        lastMessage: latest
          ? {
              id: latest.id,
              senderId: latest.senderId,
              body: latest.deletedAt ? null : latest.body,
              createdAt: toIso(latest.createdAt),
              readAt: toIso(latest.readAt),
              editedAt: toIso(latest.editedAt),
              deletedAt: toIso(latest.deletedAt),
            }
          : null,
      };
    })
    .filter((item) => {
      if (!query.search?.trim()) return true;
      const term = query.search.trim().toLowerCase();
      const haystacks = [
        item.participant?.name?.toLowerCase() ?? "",
        String(item.lastMessage?.body ?? "").toLowerCase(),
      ];
      return haystacks.some((entry) => entry.includes(term));
    })
    .filter((item) => (query.unreadOnly ? item.unreadCount > 0 : true));

  const { page, limit } = resolvePagination(query, { maxLimit: 50 });
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    items: paged,
    pagination: buildPaginationMeta(page, limit, items.length),
  };
}

export async function getOrCreateConversation(
  userId: string,
  input: {
    participantUserId: string;
    jobId?: string | null;
    contractId?: string | null;
  },
) {
  await assertMessageRelationship(userId, input.participantUserId, input);

  const existingRows = await db
    .select({ conversationId: conversationParticipant.conversationId })
    .from(conversationParticipant)
    .where(eq(conversationParticipant.userId, userId));

  const existingIds = existingRows.map((row) => row.conversationId);

  if (existingIds.length > 0) {
    const candidates = await db
      .select({
        row: conversationParticipant,
      })
      .from(conversationParticipant)
      .where(inArray(conversationParticipant.conversationId, existingIds));

    const participantMap = new Map<string, Set<string>>();
    for (const candidate of candidates) {
      const set = participantMap.get(candidate.row.conversationId) ?? new Set<string>();
      set.add(candidate.row.userId);
      participantMap.set(candidate.row.conversationId, set);
    }

    for (const [conversationId, set] of participantMap.entries()) {
      if (!(set.has(userId) && set.has(input.participantUserId) && set.size === 2)) continue;

      const [existingConversation] = await db
        .select()
        .from(conversation)
        .where(eq(conversation.id, conversationId))
        .limit(1);
      if (!existingConversation) continue;

      if (input.contractId && existingConversation.contractId !== input.contractId) continue;
      if (input.jobId && existingConversation.jobId !== input.jobId) continue;

      return existingConversation;
    }
  }

  const id = crypto.randomUUID();
  const [created] = await db
    .insert(conversation)
    .values({
      id,
      jobId: input.jobId ?? null,
      contractId: input.contractId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create conversation");
  }

  await db.insert(conversationParticipant).values([
    {
      conversationId: id,
      userId,
      createdAt: new Date(),
      lastReadAt: null,
    },
    {
      conversationId: id,
      userId: input.participantUserId,
      createdAt: new Date(),
      lastReadAt: null,
    },
  ]);

  return created;
}

export async function getConversation(userId: string, conversationId: string) {
  await ensureParticipant(conversationId, userId);

  const [conversationRow] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);
  if (!conversationRow) throw new ConversationNotFoundError();

  const participants = await getConversationParticipants(conversationId);
  return {
    id: conversationRow.id,
    jobId: conversationRow.jobId,
    contractId: conversationRow.contractId,
    createdAt: toIso(conversationRow.createdAt),
    updatedAt: toIso(conversationRow.updatedAt),
    participants: participants.map((participant) => ({
      userId: participant.userId,
      name: participant.name,
      image: participant.image,
    })),
  };
}

export async function listConversationMessages(
  userId: string,
  conversationId: string,
  query: MessageListQuery = {},
) {
  await ensureParticipant(conversationId, userId);

  const { page, limit, offset } = resolvePagination(query, { defaultLimit: 30, maxLimit: 100 });
  const rows = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(desc(message.createdAt))
    .limit(limit)
    .offset(offset);

  const messageIds = rows.map((row) => row.id);
  const attachmentRows =
    messageIds.length > 0
      ? await db
          .select()
          .from(messageAttachment)
          .where(inArray(messageAttachment.messageId, messageIds))
      : [];

  const attachmentMap = buildAttachmentMap(attachmentRows);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(message)
    .where(eq(message.conversationId, conversationId));

  return {
    items: rows.map((row) => serializeMessage(row, attachmentMap.get(row.id) ?? [])).toReversed(),
    pagination: buildPaginationMeta(page, limit, Number(countRow?.count ?? 0)),
  };
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: {
    body?: string | null;
    attachments?: ChatAttachmentInput[];
  },
) {
  await ensureParticipant(conversationId, userId);

  const body = input.body?.trim() ?? "";
  const attachments = input.attachments ?? [];
  if (!body && attachments.length === 0) {
    throw new ValidationError(
      ["Provide a message body or at least one attachment"],
      "Empty message",
    );
  }

  if (attachments.length > 5) {
    throw new ValidationError(
      ["You can attach up to 5 files in one message"],
      "Too many attachments",
    );
  }

  const now = new Date();
  const [created] = await db
    .insert(message)
    .values({
      id: crypto.randomUUID(),
      conversationId,
      senderId: userId,
      body: body || null,
      createdAt: now,
      readAt: null,
      editedAt: null,
      deletedAt: null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create message");
  }

  await db.update(conversation).set({ updatedAt: now }).where(eq(conversation.id, conversationId));

  const createdAttachments =
    attachments.length > 0
      ? await db
          .insert(messageAttachment)
          .values(
            attachments.map((attachment) => ({
              id: crypto.randomUUID(),
              messageId: created.id,
              uploaderUserId: userId,
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              mimeType: attachment.mimeType ?? null,
              sizeBytes: attachment.sizeBytes ?? null,
            })),
          )
          .returning()
      : [];

  const serialized = serializeMessage(created, createdAttachments.map(serializeAttachment));

  await emitConversationEvent(conversationId, () => ({
    type: "chat:message:new",
    payload: serialized,
  }));

  const participants = await getConversationParticipants(conversationId);
  const sender = participants.find((participant) => participant.userId === userId);
  const recipients = participants.filter((participant) => participant.userId !== userId);
  const senderName = sender?.name ?? "New message";
  const recipientProfiles =
    recipients.length > 0
      ? await db
          .select({
            userId: marketplaceUserProfile.userId,
            activeRole: marketplaceUserProfile.activeRole,
          })
          .from(marketplaceUserProfile)
          .where(
            inArray(
              marketplaceUserProfile.userId,
              recipients.map((recipient) => recipient.userId),
            ),
          )
      : [];
  const roleByUserId = new Map(
    recipientProfiles.map((profile) => [profile.userId, profile.activeRole]),
  );

  await createNotifications(
    recipients.map((recipient) => {
      const activeRole = roleByUserId.get(recipient.userId) === "hirer" ? "hirer" : "freelancer";
      return {
        userId: recipient.userId,
        type: "message",
        title: senderName,
        body:
          body ||
          `${createdAttachments.length} attachment${createdAttachments.length > 1 ? "s" : ""}`,
        actionUrl: buildConversationPath(activeRole, conversationId),
      };
    }),
  );

  return serialized;
}

export async function markConversationRead(userId: string, conversationId: string) {
  const participantRow = await ensureParticipant(conversationId, userId);
  const now = new Date();

  await db
    .update(conversationParticipant)
    .set({ lastReadAt: now })
    .where(
      and(
        eq(conversationParticipant.conversationId, conversationId),
        eq(conversationParticipant.userId, userId),
      ),
    );

  await db
    .update(message)
    .set({ readAt: now })
    .where(
      and(
        eq(message.conversationId, conversationId),
        ne(message.senderId, userId),
        isNotNull(message.createdAt),
        participantRow.lastReadAt
          ? sql`${message.createdAt} > ${participantRow.lastReadAt}`
          : sql`true`,
      ),
    );

  await emitConversationEvent(conversationId, () => ({
    type: "chat:conversation:read",
    payload: {
      conversationId,
      userId,
      readAt: now.toISOString(),
    },
  }));

  return { conversationId, readAt: now.toISOString() };
}

export async function editMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  body: string,
) {
  await ensureParticipant(conversationId, userId);
  const normalized = body.trim();
  if (!normalized) {
    throw new ValidationError(["Message body cannot be empty"], "Invalid message");
  }

  const [existing] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.conversationId, conversationId)))
    .limit(1);
  if (!existing) throw new MessageNotFoundError();
  if (existing.senderId !== userId) throw new ChatAccessError();
  if (existing.deletedAt)
    throw new ValidationError(["Cannot edit a deleted message"], "Message deleted");

  const [updated] = await db
    .update(message)
    .set({ body: normalized, editedAt: new Date() })
    .where(eq(message.id, messageId))
    .returning();
  if (!updated) throw new MessageNotFoundError();

  await emitConversationEvent(conversationId, () => ({
    type: "chat:message:updated",
    payload: serializeMessage(updated),
  }));

  return serializeMessage(updated);
}

export async function deleteMessage(userId: string, conversationId: string, messageId: string) {
  await ensureParticipant(conversationId, userId);

  const [existing] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.conversationId, conversationId)))
    .limit(1);
  if (!existing) throw new MessageNotFoundError();
  if (existing.senderId !== userId) throw new ChatAccessError();

  const [updated] = await db
    .update(message)
    .set({ body: null, deletedAt: new Date() })
    .where(eq(message.id, messageId))
    .returning();
  if (!updated) throw new MessageNotFoundError();

  await emitConversationEvent(conversationId, () => ({
    type: "chat:message:updated",
    payload: serializeMessage(updated),
  }));

  return serializeMessage(updated);
}

export async function publishTypingState(
  userId: string,
  conversationId: string,
  isTyping: boolean,
) {
  await ensureParticipant(conversationId, userId);
  await emitConversationEvent(conversationId, () => ({
    type: "chat:typing",
    payload: {
      conversationId,
      userId,
      isTyping,
      at: new Date().toISOString(),
    },
  }));
}
