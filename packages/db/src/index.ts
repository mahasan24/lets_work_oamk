import { env } from "@lets_work/env/server";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb(): NodePgDatabase<typeof schema> {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();
