import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { job } from "./jobs";

export const savedJob = pgTable(
  "saved_job",
  {
    id: text("id").primaryKey(),
    freelancerUserId: text("freelancer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("saved_job_freelancer_user_id_idx").on(table.freelancerUserId),
    uniqueIndex("saved_job_unique_idx").on(table.freelancerUserId, table.jobId),
  ],
);
