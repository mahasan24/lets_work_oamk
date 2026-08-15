/**
 * Completely wipe application schemas (all marketplace + auth tables).
 *
 * Drops `public` and `drizzle` (migration history lives in `drizzle`, so wiping
 * only `public` makes `migrate` report success without recreating tables).
 *
 * Usage:
 *   bun run db:reset
 */
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to reset the database");
  process.exit(1);
}

const SYSTEM_SCHEMAS = new Set(["pg_catalog", "information_schema", "pg_toast"]);

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const { rows } = await client.query<{ nspname: string }>(
    `SELECT nspname
     FROM pg_namespace
     WHERE nspname NOT LIKE 'pg_temp%'
       AND nspname NOT LIKE 'pg_toast_temp%'
       AND nspname <> ALL($1::text[])`,
    [Array.from(SYSTEM_SCHEMAS)],
  );

  for (const { nspname } of rows) {
    console.log(`Dropping schema ${nspname} (CASCADE)…`);
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(nspname)} CASCADE`);
  }

  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  await client.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");
  console.log("Public schema recreated (migration history cleared).");
} finally {
  await client.end();
}

process.exit(0);

function quoteIdent(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
