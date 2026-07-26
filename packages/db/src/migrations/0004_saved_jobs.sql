CREATE TABLE IF NOT EXISTS "saved_job" (
	"id" text PRIMARY KEY NOT NULL,
	"freelancer_user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_job" ADD CONSTRAINT "saved_job_freelancer_user_id_user_id_fk" FOREIGN KEY ("freelancer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_job" ADD CONSTRAINT "saved_job_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_job_freelancer_user_id_idx" ON "saved_job" USING btree ("freelancer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_job_unique_idx" ON "saved_job" USING btree ("freelancer_user_id","job_id");
