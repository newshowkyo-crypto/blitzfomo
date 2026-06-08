#!/bin/sh
set -eu

cd /opt/blitzfomo
set -a
. ./.env.production
set +a

docker exec \
  -e SMOKE_BASE_URL=http://nginx \
  -e ADMIN_USERNAME="$ADMIN_USERNAME" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e BOT_TOKEN="$BOT_TOKEN" \
  blitz-api \
  node scripts/smoke-role-api.js
