import { Elysia, t } from "elysia";

import {
  deleteMessage,
  editMessage,
  getConversation,
  getOrCreateConversation,
  listConversationMessages,
  listConversations,
  markConversationRead,
  sendMessage,
} from "../lib/chat";
import { runAction as runChatAction } from "../lib/http";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

const attachmentSchema = t.Object({
  fileName: t.String({ minLength: 1 }),
  fileUrl: t.String({ format: "uri" }),
  mimeType: t.Optional(t.Nullable(t.String())),
  sizeBytes: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
});

export const chatRoutes = new Elysia({
  prefix: "/api/chat",
  detail: {
    tags: ["Chat"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/conversations",
    async ({ user, query, status }) => {
      const result = await runChatAction(() =>
        listConversations(user.id, {
          page: query.page,
          limit: query.limit,
          search: query.search,
          unreadOnly: query.unreadOnly,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        search: t.Optional(t.String()),
        unreadOnly: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "List conversations",
      },
    },
  )
  .post(
    "/conversations",
    async ({ user, body, status }) => {
      const result = await runChatAction(async () => {
        const conversation = await getOrCreateConversation(user.id, body);
        return getConversation(user.id, conversation.id);
      });
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      body: t.Object({
        participantUserId: t.String(),
        jobId: t.Optional(t.Nullable(t.String())),
        contractId: t.Optional(t.Nullable(t.String())),
      }),
      detail: {
        summary: "Create or get direct conversation",
      },
    },
  )
  .get(
    "/conversations/:conversationId",
    async ({ user, params, status }) => {
      const result = await runChatAction(() => getConversation(user.id, params.conversationId));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ conversationId: t.String() }),
      detail: {
        summary: "Get conversation details",
      },
    },
  )
  .get(
    "/conversations/:conversationId/messages",
    async ({ user, params, query, status }) => {
      const result = await runChatAction(() =>
        listConversationMessages(user.id, params.conversationId, {
          page: query.page,
          limit: query.limit,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ conversationId: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "List conversation messages",
      },
    },
  )
  .post(
    "/conversations/:conversationId/messages",
    async ({ user, params, body, status }) => {
      const result = await runChatAction(() => sendMessage(user.id, params.conversationId, body));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ conversationId: t.String() }),
      body: t.Object({
        body: t.Optional(t.Nullable(t.String())),
        attachments: t.Optional(t.Array(attachmentSchema)),
      }),
      detail: {
        summary: "Send message",
      },
    },
  )
  .post(
    "/conversations/:conversationId/read",
    async ({ user, params, status }) => {
      const result = await runChatAction(() =>
        markConversationRead(user.id, params.conversationId),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ conversationId: t.String() }),
      detail: {
        summary: "Mark conversation as read",
      },
    },
  )
  .patch(
    "/conversations/:conversationId/messages/:messageId",
    async ({ user, params, body, status }) => {
      const result = await runChatAction(() =>
        editMessage(user.id, params.conversationId, params.messageId, body.body),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({
        conversationId: t.String(),
        messageId: t.String(),
      }),
      body: t.Object({
        body: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Edit a sent message",
      },
    },
  )
  .delete(
    "/conversations/:conversationId/messages/:messageId",
    async ({ user, params, status }) => {
      const result = await runChatAction(() =>
        deleteMessage(user.id, params.conversationId, params.messageId),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({
        conversationId: t.String(),
        messageId: t.String(),
      }),
      detail: {
        summary: "Delete a sent message",
      },
    },
  );
