/**
 * Fail fast if migrations did not recreate the auth user table.
 */
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const { rows } = await client.query<{ rel: string | null }>(
    "SELECT to_regclass('public.user') AS rel",
  );
  if (!rows[0]?.rel) {
    console.error("Schema check failed: public.user does not exist after migrate");
    process.exit(1);
  }
  console.log("Schema check ok (public.user exists)");
} finally {
  await client.end();
}

process.exit(0);
