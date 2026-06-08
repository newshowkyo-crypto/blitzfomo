#!/bin/sh
set -eu

cd /opt/blitzfomo

read_env() {
  key="$1"
  grep -E "^${key}=" .env.production | head -n 1 | sed -E "s/^${key}=//" | tr -d '\r'
}

ADMIN_USERNAME="$(read_env ADMIN_USERNAME)"
ADMIN_PASSWORD="$(read_env ADMIN_PASSWORD)"
BOT_TOKEN="$(read_env BOT_TOKEN)"

docker exec \
  -e SMOKE_BASE_URL=http://nginx \
  -e ADMIN_USERNAME="$ADMIN_USERNAME" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e BOT_TOKEN="$BOT_TOKEN" \
  blitz-api \
  node scripts/smoke-role-api.js
