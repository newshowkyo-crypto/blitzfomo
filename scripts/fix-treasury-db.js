const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Treasury Reconcile Database Fix ===');
  
  // Get pool prize diffs
  const poolPrizeDiffs = await prisma.$queryRaw`
    WITH ledger AS (
      SELECT "poolId" AS pool_id, COALESCE(SUM(amount), 0) AS ledger_prize
      FROM road_treasury_ledger
      WHERE "seasonCode" = 'WC2026' AND bucket = 'POOL_PRIZE' AND "poolId" IS NOT NULL
      GROUP BY "poolId"
    )
    SELECT p.id AS pool_id, p.stage, p.status,
           p."prizePool" AS pool_prize,
           COALESCE(l.ledger_prize, 0) AS ledger_prize,
           (p."prizePool" - COALESCE(l.ledger_prize, 0)) AS diff
    FROM road_pools p
    LEFT JOIN ledger l ON l.pool_id = p.id
    WHERE p."prizePool" <> COALESCE(l.ledger_prize, 0)
    ORDER BY ABS(p."prizePool" - COALESCE(l.ledger_prize, 0)) DESC
    LIMIT 50
  `;
  
  console.log('\n=== Pool Prize Diffs ===');
  console.log(poolPrizeDiffs);
  
  // Fix pool prize diffs
  for (const diff of poolPrizeDiffs) {
    const diffAmount = Number(diff.diff);
    if (diffAmount !== 0) {
      console.log(`\nFixing pool ${diff.pool_id}: adding ${diffAmount} to POOL_PRIZE`);
      await prisma.roadTreasuryLedger.create({
        data: {
          seasonCode: 'WC2026',
          eventType: 'STAGE_ADVANCE',
          eventId: `fix_pool_prize_${diff.pool_id}_${Date.now()}`,
          entryKey: `POOL_PRIZE|${diff.pool_id}|||`,
          bucket: 'POOL_PRIZE',
          amount: BigInt(diffAmount),
          poolId: diff.pool_id,
        },
      });
    }
  }
  
  // Get pending reward diffs
  const pendingDiffs = await prisma.$queryRaw`
    WITH holding AS (
      SELECT "poolId" AS pool_id, COALESCE(SUM("pendingReward"), 0) AS holding_pending
      FROM road_key_holdings
      GROUP BY "poolId"
    ),
    ledger AS (
      SELECT "poolId" AS pool_id, COALESCE(SUM(amount), 0) AS ledger_pending
      FROM road_treasury_ledger
      WHERE "seasonCode" = 'WC2026' AND bucket = 'PENDING_REWARD' AND "poolId" IS NOT NULL
      GROUP BY "poolId"
    )
    SELECT p.id AS pool_id, p.stage, p.status,
           COALESCE(h.holding_pending, 0) AS holding_pending,
           COALESCE(l.ledger_pending, 0) AS ledger_pending,
           (COALESCE(h.holding_pending, 0) - COALESCE(l.ledger_pending, 0)) AS diff
    FROM road_pools p
    LEFT JOIN holding h ON h.pool_id = p.id
    LEFT JOIN ledger l ON l.pool_id = p.id
    WHERE COALESCE(h.holding_pending, 0) <> COALESCE(l.ledger_pending, 0)
    ORDER BY ABS(COALESCE(h.holding_pending, 0) - COALESCE(l.ledger_pending, 0)) DESC
    LIMIT 50
  `;
  
  console.log('\n=== Pending Reward Diffs ===');
  console.log(pendingDiffs);
  
  // Fix pending reward diffs
  for (const diff of pendingDiffs) {
    const diffAmount = Number(diff.diff);
    if (diffAmount !== 0) {
      console.log(`\nFixing pool ${diff.pool_id}: adding ${diffAmount} to PENDING_REWARD`);
      await prisma.roadTreasuryLedger.create({
        data: {
          seasonCode: 'WC2026',
          eventType: 'PURCHASE',
          eventId: `fix_pending_${diff.pool_id}_${Date.now()}`,
          entryKey: `PENDING_REWARD|${diff.pool_id}|||`,
          bucket: 'PENDING_REWARD',
          amount: BigInt(diffAmount),
          poolId: diff.pool_id,
        },
      });
    }
  }
  
  // Get super jackpot diff
  const [superJackpot, superSumRow] = await Promise.all([
    prisma.superJackpot.findUnique({ where: { seasonCode: 'WC2026' } }),
    prisma.roadTreasuryLedger.aggregate({
      where: { seasonCode: 'WC2026', bucket: 'SUPER_JACKPOT' },
      _sum: { amount: true },
    }),
  ]);
  
  const ledgerSuper = superSumRow._sum.amount ?? 0n;
  const dbSuper = superJackpot?.amount ?? 0n;
  const superDiff = dbSuper - ledgerSuper;
  
  console.log('\n=== Super Jackpot Diff ===');
  console.log({ db: Number(dbSuper), treasury: Number(ledgerSuper), diff: Number(superDiff) });
  
  if (superDiff !== 0n) {
    console.log(`\nFixing super jackpot: adding ${Number(superDiff)} to SUPER_JACKPOT`);
    await prisma.roadTreasuryLedger.create({
      data: {
        seasonCode: 'WC2026',
        eventType: 'PURCHASE',
        eventId: `fix_super_jackpot_${Date.now()}`,
        entryKey: 'SUPER_JACKPOT||||',
        bucket: 'SUPER_JACKPOT',
        amount: superDiff,
      },
    });
  }
  
  console.log('\n✅ Fix completed!');
  
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
