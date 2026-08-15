/**
 * Completely wipe the public schema (all marketplace + auth tables).
 *
 * Used by the production API entrypoint so each deploy starts from a clean
 * thesis demo database. Then migrations recreate the schema.
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

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  console.log("Dropping public schema (CASCADE)…");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  console.log("Public schema recreated.");
} finally {
  await client.end();
}

process.exit(0);
