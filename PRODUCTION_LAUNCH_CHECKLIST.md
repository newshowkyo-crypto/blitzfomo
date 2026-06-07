# Blitz Fomo Production Launch Checklist

Use this as the final launch gate for `blitzfomo.com`.

## 1. Required User Inputs

- VPS IP address and SSH port.
- VPS OS confirmation, preferably Ubuntu 22.04/24.04 or Debian 12.
- Domain DNS A record: `blitzfomo.com -> VPS_IP`.
- Optional DNS CNAME/A record: `www.blitzfomo.com -> VPS_IP`.
- Telegram Bot Token from `@BotFather`.
- Telegram Mini App / Web App URL set to `https://blitzfomo.com`.
- Plisio merchant account access.
- Plisio API key in production `.env.production`.

Do not paste VPS password or secrets into public chat. Enter them only on the server.

## 2. Plisio Settings

Set the Plisio callback/status URL exactly:

```text
https://blitzfomo.com/api/payment/webhook/plisio?json=true
```

Recommended first production gateway settings:

```env
ACTIVE_PAYMENT_GATEWAY=plisio
PLISIO_ALLOWED_PSYS_CIDS=USDT_TRX,USDT_TON,TON,TRX
PLISIO_SOURCE_CURRENCY=USD
PLISIO_EXPIRE_MIN=60
PUBLIC_API_BASE_URL=https://blitzfomo.com
TMA_PUBLIC_URL=https://blitzfomo.com
```

## 3. Production `.env.production`

Copy the template:

```powershell
Copy-Item .env.production.example .env.production
```

Fill every `change_me_*` value:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `BOT_TOKEN`
- `ADMIN_PASSWORD`
- `OPERATOR_PASSWORD`
- `PLISIO_API_KEY`

`JWT_SECRET`, database password, Redis password, and admin password must be unique strong values.

## 4. Build and Local Validation

Run before packaging or deploying:

```powershell
npm run build --workspace apps/api
npm run build --workspace apps/admin
node -e "const fs=require('fs'),vm=require('vm');const html=fs.readFileSync('web/index.html','utf8');const m=html.match(/<script>([\s\S]*)<\/script>/);new vm.Script(m[1]);console.log('web script ok')"
docker compose config --quiet
powershell -ExecutionPolicy Bypass -File scripts/local-smoke.ps1
```

Expected result:

- API build succeeds.
- Admin build succeeds.
- `web script ok`.
- Docker compose config succeeds.
- Smoke creates a mock order and ends with `Smoke OK`.

## 5. VPS Deployment Order

On the VPS:

```bash
apt update
apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker
```

Upload or clone the project, then:

```bash
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Caddy will request HTTPS certificates automatically after DNS points to the VPS and ports `80/443` are open.

The API container runs database migration (`prisma migrate deploy`), seeding, and then
`node dist/apps/api/src/main.js`. The NestJS monorepo build emits the entry under
`dist/apps/api/src/main.js` (not `dist/main.js`) because of the `@blitz/shared`
path mapping. This is expected; do not "fix" it back.

### Migration: fresh DB vs. existing `db push` DB

`docker-compose.prod.yml` runs `prisma migrate deploy`, which applies the committed
migration in `prisma/migrations/20260605_initial`.

- **Fresh VPS / empty DB**: nothing extra to do. The prod stack can run
  `migrate deploy` directly — the initial migration creates the full schema on first boot.
- **Existing DB created by `prisma db push`** (schema already present, but no
  `_prisma_migrations` history): `migrate deploy` would fail with "table already exists".
  Baseline the initial migration as already-applied **once**, before bringing the stack up:

  ```bash
  npx prisma migrate resolve --applied 20260605_initial --schema=prisma/schema.prisma
  ```

  After this one-time baseline, subsequent `migrate deploy` runs are clean.

### View logs

```bash
# All services, follow
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# A single service (api / caddy / nginx / postgres / redis / admin)
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api

# Last 200 lines without following
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 api
```

If the API keeps restarting, read `logs api` first. A missing required env var
(`DATABASE_URL`, `JWT_SECRET`, `BOT_TOKEN`, `ADMIN_PASSWORD`, `PLISIO_API_KEY`, ...)
will stop the stack with a clear `VAR is required` message.

## 6. Required Open Ports

- SSH port, usually `22`.
- HTTP `80`.
- HTTPS `443`.

Do not expose PostgreSQL or Redis publicly in production.

## 7. Final Production Smoke

After deployment:

```bash
curl -I https://blitzfomo.com
curl https://blitzfomo.com/api/game/state
curl -I https://blitzfomo.com/admin/
```

Then test on a phone inside Telegram:

- Open the Mini App.
- Login through Telegram WebView.
- Create a small Plisio deposit order.
- Open invoice.
- Pay a tiny amount.
- Confirm order changes to `PAID`.
- Confirm BF balance increases.
- Confirm Admin payment page sees the paid order.

## 8. Rollback

If Plisio has issues, temporarily switch gateway:

```env
ACTIVE_PAYMENT_GATEWAY=mock
```

Then restart:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api
```

Use this only to keep the app reachable while fixing payment settings.

## 9. First Real Plisio Callback Verification

On the very first real deposit, watch the API logs while the order moves to `PAID`:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
```

- A successful callback returns HTTP 200 and the order becomes `PAID`.
- If the order stays `PENDING` after on-chain payment confirms, check the logs for
  `Invalid callback signature`. That means the `verify_hash` check rejected the
  payload. Confirm the Plisio Status URL is exactly
  `https://blitzfomo.com/api/payment/webhook/plisio?json=true` (with `?json=true`)
  and that the same `PLISIO_API_KEY` is used for invoice creation and verification.
- Credited amount always uses the database order amount, never the callback amount.
  A `mismatch` status is intentionally NOT auto-credited. Reconcile it manually from
  the Admin payment page after checking the actual on-chain amount.

## 10. Current Known Non-Blocking Items

- Bot purchase trigger still has TODO text and is not required for user deposits.
- Admin payment gateway config storage still has an encryption TODO; keep real Plisio key in `.env.production`, not in Admin UI. The Plisio gateway only ever reads `PLISIO_API_KEY` from env.
- Real Plisio payment must be tested on public HTTPS because local Docker cannot receive Plisio callbacks without a public tunnel.

## Launch Decision

Launch only when all are true:

- DNS points to VPS.
- HTTPS works.
- Telegram Mini App URL is set.
- `.env.production` has no `change_me_*` values.
- Plisio Status URL is configured.
- Real small Plisio payment reaches `PAID`.
- Admin password has been replaced.
