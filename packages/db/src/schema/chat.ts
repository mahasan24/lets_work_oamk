import { pgTable, text, timestamp, index, primaryKey, integer } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contract } from "./contracts";
import { job } from "./jobs";

export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").references(() => job.id, { onDelete: "set null" }),
    contractId: text("contract_id").references(() => contract.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("conversation_job_id_idx").on(table.jobId),
    index("conversation_contract_id_idx").on(table.contractId),
  ],
);

export const conversationParticipant = pgTable(
  "conversation_participant",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_participant_user_id_idx").on(table.userId),
  ],
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body"),
    attachmentUrl: text("attachment_url"),
    readAt: timestamp("read_at"),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_conversation_id_idx").on(table.conversationId),
    index("message_sender_id_idx").on(table.senderId),
  ],
);

export const messageAttachment = pgTable(
  "message_attachment",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    uploaderUserId: text("uploader_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_attachment_message_id_idx").on(table.messageId),
    index("message_attachment_uploader_user_id_idx").on(table.uploaderUserId),
  ],
);
