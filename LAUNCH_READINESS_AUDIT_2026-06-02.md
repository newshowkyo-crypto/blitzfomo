# BlitzFomo Launch Readiness Audit - 2026-06-02

## Current Verification
- `node scripts/verify-fixes.js`: passed.
- `node scripts/full-functional-audit.js`: passed, 21/21.
- API/Admin/Nginx local Docker stack is functional.
- Production payment callback still needs one real Plisio payment over public HTTPS.

## Gameplay Loop
1. User enters Telegram Mini App.
2. Telegram initData login creates/loads the user.
3. User deposits crypto through Plisio.
4. Confirmed deposit credits BF balance 1:1.
5. User buys into the active round.
6. Each real buy increases prize pool and resets countdown.
7. When countdown reaches zero, the last real buyer receives 70% of the round prize pool.
8. User requests withdrawal.
9. Admin manually reviews and pays out; rejection refunds frozen balance.

The loop is technically coherent. The main remaining issue is not code flow; it is the economic configuration.

## Profit Model
Nominal rule: winner receives 70%, platform keeps 30%.

Real operator profit per round is:

```text
profit = player_purchases - 0.70 * (initial_prize_pool + player_purchases)
       = 0.30 * player_purchases - 0.70 * initial_prize_pool
```

Break-even:

```text
player_purchases >= 2.333 * initial_prize_pool
```

Current local config:
- `initialPrizePool = 1000 BF`
- `minBuyAmount = 1 BF`
- `countdownSeconds = 60`
- `winnerPercent = 70`
- `platformPercent = 30`
- `activePaymentGateway = mock`
- `botEnabled = true`

With `initialPrizePool = 1000 BF`, every real-winner round needs at least `2333 BF` in real purchases to break even. If a round settles after only small buys, the operator loses heavily.

## Must Change Before Production
1. Set `ACTIVE_PAYMENT_GATEWAY=plisio`; never launch with `mock`.
2. Set initial prize pool low unless you intentionally fund it as marketing spend.
   - Conservative test: `initialPrizePool = 0-50 BF`
   - Small launch event: `initialPrizePool = 100-300 BF`
   - Do not use `1000 BF` unless you are prepared to lose it repeatedly.
3. Set countdown longer than 60 seconds for launch.
   - Recommended: 180-300 seconds.
4. Keep bot auto mode off at launch, or use very conservative activity-only bots.
   - Bots must not increase prize pool or affect winners.
5. Increase withdrawal safety:
   - `withdrawRequirePurchaseCount >= 2`
   - `withdrawCooldownHours >= 12`
   - low daily limit during first 48 hours.
6. Disable or tightly control manual mark-paid usage.
   - It is now transaction/idempotency safer, but still should be used only for verified Plisio mismatch/manual reconciliation.
7. Do not advertise referral commission yet.
   - The UI mentions referral/commission, but there is no real referral ledger system.

## Needed From Operator
- Domain DNS pointed to VPS.
- VPS SSH access and deployed repo.
- Production `.env.production` with strong secrets.
- Telegram Bot Token and Mini App URL set to `https://blitzfomo.com`.
- Plisio production key.
- Plisio callback URL: `https://blitzfomo.com/api/payment/webhook/plisio?json=true`.
- Withdrawal payout wallet(s) and manual payout SOP.
- Minimum reserve fund for payouts.
- Admin password changed; operator account password changed.
- Support channel/contact for payment and withdrawal issues.
- Final rules text in English/Chinese explaining last-buyer mechanics, payout review, and withdrawal limits.

## Cold Start Plan
Recommended first 72 hours:
1. Launch as a limited beta, not a “big prize” public blast.
2. Use small seed pools and short event windows around football content.
3. Push in Telegram football/crypto groups with clear rules and screenshots.
4. Use manual bot trigger only to test activity display; do not use fake withdrawals or fake winners.
5. Run one public “proof round” with a small real payout and post transaction proof.
6. After 10-30 real paid users and several successful withdrawals, increase prize pools gradually.

## Success Probability
- Technical readiness after current fixes: high for beta.
- Business success without traffic/KOL/community budget: low to medium.
- Business success with Telegram football channels, crypto groups, small prize events, and fast payout proof: medium.
- Biggest risk is not UI now; it is liquidity, trust, and payout economics.

## Final Launch Gate
Do not go public until all are true:
- Local audit is green.
- Public HTTPS deploy is green.
- Real Plisio deposit changes `PENDING -> PAID`.
- Admin can see the paid order and credited BF.
- One small real withdrawal is manually paid and marked `PAID`.
- Initial pool/cooldown/withdraw rules are adjusted to avoid guaranteed operator loss.
- Referral commission language is removed or clearly marked as coming soon.
