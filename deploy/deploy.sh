#!/usr/bin/env bash
set -euo pipefail

# Run on the VPS from the repo root.
# Example:
#   ./deploy/deploy.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.production.example and fill secrets."
  exit 1
fi

echo "==> Pulling latest main"
git fetch origin main
git checkout main
git pull --ff-only origin main

echo "==> Building and starting containers"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build --remove-orphans

echo "==> Waiting for API health"
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
    bun -e "fetch('http://127.0.0.1:3000/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "API did not become healthy in time"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=80 api
    exit 1
  fi
  sleep 2
done

echo "==> Running database migrations"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
  bun --cwd /app/packages/db run db:migrate

echo "==> Deploy complete"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
