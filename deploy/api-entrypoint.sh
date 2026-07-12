#!/bin/sh
set -eu

echo "==> Running database migrations"
bun /app/packages/db/src/migrate.ts

echo "==> Starting API"
cd /app/apps/server
exec bun run src/index.ts
