# Anti-Abuse & Game Loop Audit

Generated: 2026-06-01
Scope: payment credit, purchase, prize-pool/deadline, settlement basis, withdraw freeze/refund, admin review, replay/idempotency.

## Result

- P0 exploitable issues found and fixed: 5
- Full functional audit after fixes: 15 passed / 0 failed
- Anti-abuse smoke: same idempotency key x10 concurrent -> 1 real purchase, 9 duplicate responses, balance charged once
- Invalid negative payment amount -> rejected

## Fixed P0/P1 Issues

1. Production registration bonus removed.
   - Before: every new Telegram user received 1000 BF as RECHARGE ledger, which could be farmed by account creation + min purchase + withdraw review.
   - After: production new users start at 0; local dev still keeps demo balance.

2. Ledger writes now lock the user row.
   - Before: code comment said FOR UPDATE, but Prisma findUnique did not lock the row.
   - Risk: concurrent purchases/withdraws could pass stale balance checks.
   - After: `SELECT ... FOR UPDATE` is used before every ledger balance mutation.

3. Payment success is now idempotent in a DB transaction.
   - Before: concurrent valid callbacks could both see PENDING and double-credit.
   - After: status transition PENDING -> PAID and recharge ledger are one guarded transaction.

4. Purchase now updates the database round, not only Redis.
   - Before: purchase mutated Redis prize pool/deadline, but settlement reads DB `round.prizePool` and `deadlineAt`.
   - Risk: payout could ignore real purchases, and countdown/settlement could diverge.
   - After: purchase transaction increments DB prize pool, resets DB deadline, records last buyer, writes purchase, and deducts ledger together.

5. State hydration no longer extends expired rounds.
   - Before: reading game state after expiry could refresh an expired OPEN round deadline.
   - Risk: users/bots could keep a round alive by polling instead of allowing settlement.
   - After: reads only hydrate Redis from DB; they do not extend expired DB rounds.

## Additional Guards Added

- Purchase rate limit per user/minute uses Redis and `riskConfig.purchaseRateLimitPerMin`.
- Frozen users cannot purchase or withdraw.
- Withdrawal create + balance freeze is now transactional.
- Withdrawal reject + refund is now transactional and status-gated.
- Admin withdrawal approval/rejection is status-gated and audited.
- Payment create rejects invalid, negative, tiny, and excessive amounts.
- Concurrent same-key purchases return duplicate instead of server errors.

## Remaining Non-Blocking Risks

- Real Plisio callback still must be tested once over public HTTPS before traffic.
- Referral/commission remains presentation-level; do not market referral earnings until backend attribution/ledger exists.
- Bot operations should stay conservative/off until you decide exact anti-trust strategy for fake liquidity.
- Admin manual balance adjustment remains powerful; only SUPER_ADMIN should use it, with a strong password and VPN/IP restriction if possible.

## Validation Commands

- `npm run build --workspace apps/api` -> passed
- `docker compose up -d --build api` -> passed
- `node scripts/full-functional-audit.js` -> 15 passed / 0 failed
- Anti-abuse smoke -> `ANTI_ABUSE_SMOKE_OK`
