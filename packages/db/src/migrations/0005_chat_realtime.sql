ALTER TABLE "message" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint

CREATE TABLE "message_attachment" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "uploader_user_id" text NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "message_attachment"
  ADD CONSTRAINT "message_attachment_message_id_message_id_fk"
  FOREIGN KEY ("message_id") REFERENCES "public"."message"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "message_attachment"
  ADD CONSTRAINT "message_attachment_uploader_user_id_user_id_fk"
  FOREIGN KEY ("uploader_user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "message_attachment_message_id_idx"
  ON "message_attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_attachment_uploader_user_id_idx"
  ON "message_attachment" USING btree ("uploader_user_id");
