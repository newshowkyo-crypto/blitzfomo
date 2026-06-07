# Blitz Fomo Local Pre-Production Checklist

This file is for local verification before VPS deployment.

## Local Development Mode

Keep the default local gateway as:

```env
ACTIVE_PAYMENT_GATEWAY=mock
```

Use mock mode to test login, deposit crediting, buy flow, withdrawals, and Admin review without creating real Plisio invoices.

## Plisio Real Payment Mode

Before switching to Plisio, configure:

```env
PLISIO_API_KEY="your_real_key"
PLISIO_ALLOWED_PSYS_CIDS="USDT_TRX,USDT_BSC,BTC,ETH,LTC,TRX"
PLISIO_SOURCE_CURRENCY="USD"
PLISIO_EXPIRE_MIN="60"
PUBLIC_API_BASE_URL="https://blitzfomo.com"
TMA_PUBLIC_URL="https://blitzfomo.com"
ACTIVE_PAYMENT_GATEWAY="plisio"
```

Set the Plisio Status URL:

```text
https://blitzfomo.com/api/payment/webhook/plisio?json=true
```

Local Docker cannot receive Plisio callbacks unless you use a public tunnel. Prefer real payment testing on the VPS.

## Payment Acceptance Criteria

- User creates a deposit order.
- Frontend shows order ID, gateway, amount, status, and invoice button.
- Plisio calls `POST /api/payment/webhook/plisio?json=true`.
- Backend verifies `verify_hash`.
- Order changes from `PENDING` to `PAID`.
- Ledger gets a `RECHARGE` entry.
- User balance increases by the database order amount.
- Admin payment page can see the paid order.

## Must Replace Before Production

- `JWT_SECRET`
- PostgreSQL password
- Redis password
- Admin password
- Operator password
- `PUBLIC_API_BASE_URL`
- `TMA_PUBLIC_URL`
- Telegram `BOT_TOKEN`
- Plisio API key

## Telegram Mini App

- Create bot with `@BotFather`.
- Set Web App URL to `https://blitzfomo.com`.
- Ensure the app opens in Telegram WebView.
- Confirm login uses Telegram `initData`.

## Quick Rollback

If real payment is unavailable, switch back to:

```env
ACTIVE_PAYMENT_GATEWAY="mock"
```

Restart the API container after changing gateway settings.
