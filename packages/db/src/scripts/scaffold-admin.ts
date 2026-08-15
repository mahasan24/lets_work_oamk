/**
 * Scaffold a platform admin user with email/password credentials.
 *
 * Defaults (override with env):
 *   ADMIN_EMAIL=admin@letswork.local
 *   ADMIN_PASSWORD=Admin123!
 *   ADMIN_NAME=Platform Admin
 *
 * Usage:
 *   bun run db:scaffold-admin
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Secret1!' bun run db:scaffold-admin
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";

import { account, user } from "../schema/auth";
import { platformUser } from "../schema/platform";

config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/server/.env"),
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required (load apps/server/.env or export it)");
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL ?? "admin@letswork.local").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "Admin123!";
const name = (process.env.ADMIN_NAME ?? "Platform Admin").trim();

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters");
  process.exit(1);
}

const db = drizzle(databaseUrl);
const passwordHash = await hashPassword(password);

const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);

let userId = existing?.id;

if (!existing) {
  userId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: true,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
  console.log(`Created admin user ${email}`);
} else {
  await db.update(user).set({ name, emailVerified: true }).where(eq(user.id, existing.id));

  const [cred] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")))
    .limit(1);

  if (cred) {
    await db.update(account).set({ password: passwordHash }).where(eq(account.id, cred.id));
  } else {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: existing.id,
      providerId: "credential",
      userId: existing.id,
      password: passwordHash,
    });
  }
  console.log(`Updated existing user ${email} as admin`);
}

if (!userId) {
  console.error("Failed to resolve admin user id");
  process.exit(1);
}

await db
  .insert(platformUser)
  .values({ userId, role: "admin" })
  .onConflictDoUpdate({
    target: platformUser.userId,
    set: { role: "admin" },
  });

console.log("");
console.log("Admin ready:");
console.log(`  URL:      /admin/login`);
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log("");
console.log("Sign in at the admin URL (not the marketplace login).");
process.exit(0);
