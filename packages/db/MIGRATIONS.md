# Database migrations

This package uses [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) for schema migrations against PostgreSQL.

## Local development

1. Start Postgres (e.g. `docker compose up -d` if your project uses Compose).
2. Ensure `apps/server/.env` has a valid `DATABASE_URL`.
3. Apply schema changes:

```bash
# Generate SQL migration files from schema changes
bun run db:generate

# Apply migrations to the database
bun run db:migrate
```

For quick local iteration without migration files, you can use:

```bash
bun run db:push
```

Prefer `db:generate` + `db:migrate` when you need reproducible history (staging/production).

## Workflow: dev → staging → production

1. **Change schema** in `packages/db/src/schema/`.
2. **Generate** a migration: `bun run db:generate` (creates files under `packages/db/src/migrations/`).
3. **Review** the generated SQL before committing.
4. **Commit** schema + migration files together.
5. **Staging**: set `DATABASE_URL` to staging, run `bun run db:migrate`.
6. **Production**: run the same migrate command against production `DATABASE_URL` during deploy (or as a release step).

## Admin users

Platform admins are stored in `platform_user` with `role = 'admin'`. To grant admin access in development:

```sql
INSERT INTO platform_user (user_id, role)
VALUES ('<your-user-id>', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Find your user id in the `user` table (by email).

## Drizzle Studio

Inspect data locally:

```bash
bun run db:studio
```
