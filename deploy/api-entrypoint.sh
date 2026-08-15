#!/bin/sh
set -eu

cd /app

# Thesis/demo VPS: wipe + reseed on every API container start (including deploys).
# Set RESET_DATABASE_ON_START=0 in .env.production to skip.
RESET="${RESET_DATABASE_ON_START:-1}"

should_reset() {
  [ "$RESET" = "1" ] || [ "$RESET" = "true" ]
}

if should_reset; then
  echo "==> Resetting database (full wipe)"
  bun /app/packages/db/src/scripts/reset-database.ts
fi

echo "==> Running database migrations"
bun /app/packages/db/src/migrate.ts

echo "==> Verifying schema"
bun /app/packages/db/src/scripts/verify-schema.ts

if should_reset; then
  echo "==> Seeding platform admin"
  bun /app/packages/db/src/scripts/scaffold-admin.ts

  echo "==> Seeding marketplace demo data"
  SEED_FORCE=1 bun /app/packages/db/src/scripts/seed-marketplace.ts
fi

echo "==> Starting API"
cd /app/apps/server
exec bun run src/index.ts
