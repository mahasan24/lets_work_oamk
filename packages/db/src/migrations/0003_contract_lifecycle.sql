ALTER TYPE "contract_status" ADD VALUE IF NOT EXISTS 'paused';--> statement-breakpoint
ALTER TYPE "contract_status" ADD VALUE IF NOT EXISTS 'disputed';--> statement-breakpoint
CREATE TYPE "public"."contract_event_type" AS ENUM('created', 'activated', 'paused', 'resumed', 'milestone_created', 'milestone_started', 'milestone_submitted', 'milestone_approved', 'milestone_revision_requested', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TABLE "contract_event" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"actor_user_id" text,
	"event_type" "contract_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"milestone_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_event" ADD CONSTRAINT "contract_event_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_event" ADD CONSTRAINT "contract_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_event" ADD CONSTRAINT "contract_event_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_event_contract_id_idx" ON "contract_event" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_event_created_at_idx" ON "contract_event" USING btree ("created_at");
