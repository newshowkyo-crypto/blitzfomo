# BlitzFomo Full Functional Test Report

Generated: 2026-06-01
Base URL: http://localhost:8081
Mode: local Docker + mock payment gateway

## Summary

- Overall: PASS_WITH_WARNINGS
- P0 launch blockers found: 0
- Automated checks: 15 passed / 0 failed
- UI smoke: mobile TMA pages and admin pages rendered; screenshots saved in `audit-output/`
- Payment loop tested locally with mock gateway: create order -> PAID -> balance credited
- Real Plisio live callback is not testable locally without public HTTPS callback; must be verified after deployment.

## Passed Coverage

### Frontend TMA

- Arena page renders on mobile viewport.
- Bottom navigation works for Arena / Rank / Wallet / Invite / Me.
- Wallet page shows Plisio deposit path, supported currency chips, withdraw form, and transaction area.
- Invite page renders referral card and copy CTA; long invite URL now truncates cleanly.
- Leaderboard and profile pages render without obvious mobile layout breakage.

Screenshots:

- `audit-output/audit-full-arena-real.png`
- `audit-output/audit-full-rank-real.png`
- `audit-output/audit-full-wallet-real.png`
- `audit-output/audit-full-invite-real.png`
- `audit-output/audit-full-profile-real.png`

### API / Player Flow

- `GET /api/game/state` responds.
- Local demo wallet auth works in non-production.
- Invalid Telegram `initData` is rejected.
- Profile read/update works.
- Mock deposit order auto-confirms and credits balance.
- Purchase succeeds.
- Duplicate idempotency key returns duplicate result without double charge.
- Oversized purchase is rejected.
- Recent purchases and winner wall respond.
- Withdraw request creates successfully after funded balance.

### Admin Flow

- Wrong admin password is rejected.
- Admin login works with local seeded credential.
- Dashboard, game, users, payments, gateways, withdrawals, game config, risk config, bot config, locales, audit logs, system logs, and rounds APIs respond.
- Withdrawal rejection works and refunds the frozen balance path.
- Audit/system CSV exports respond.
- Admin dashboard/users/payments/withdrawals pages render.

Screenshots:

- `audit-output/audit-full-admin-dashboard.png`
- `audit-output/audit-full-admin-users.png`
- `audit-output/audit-full-admin-payments.png`
- `audit-output/audit-full-admin-withdrawals.png`

## Known Warnings

### P1 Before Paid Promotion

1. Real Plisio callback must be tested on the deployed HTTPS domain.
   - Required check: create a small real invoice, pay it, confirm order changes from PENDING to PAID.
   - Watch logs for `Invalid callback signature` and `amount mismatch`.

2. Referral attribution is still mostly presentation-level.
   - UI shows invite link/count/commission.
   - Backend currently returns `referralCount = 0` and no real attribution/commission ledger was found.
   - If referral commission is part of launch marketing, implement before traffic buying.

### P2 After Launch / Not Blocking MVP

1. Bot purchase trigger endpoint still has TODO-style behavior; keep it manual/off unless needed for operations.
2. Admin payment gateway config update is intentionally no-op for secret safety; production should use env vars only.
3. Wallet-signature auth is demo-only locally and blocked in production; Telegram auth is the production path.
4. Risk engine is basic; it covers current withdraw review flow but not advanced fraud scoring.

## Files Changed In This Pass

- `web/index.html`: tightened invite link layout so long referral URLs truncate cleanly on mobile.
- `scripts/full-functional-audit.js`: added reusable local full-flow audit script.
- `FULL_FUNCTIONAL_TEST_REPORT.md`: this report.

## Launch Readiness Decision

- Codebase status: near production MVP.
- Recommended readiness: 92-95% for soft launch after real Plisio callback test.
- Not recommended yet: large paid global blast before referral attribution and live payment callback are confirmed.

## Next Required External Inputs

1. DNS A record for `blitzfomo.com` pointed to VPS IP.
2. Production `.env` values on VPS:
   - `DOMAIN=blitzfomo.com`
   - `JWT_SECRET`
   - `ADMIN_PASSWORD`
   - `BOT_TOKEN`
   - `PLISIO_API_KEY`
   - `PAYMENT_GATEWAY=plisio`
3. BotFather WebApp/Menu URL set to `https://blitzfomo.com`.
4. Plisio callback/status URL set to `https://blitzfomo.com/api/payment/webhook/plisio?json=true`.
5. One real small-value payment test before opening traffic.
