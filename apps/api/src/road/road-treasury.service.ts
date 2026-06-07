import { Injectable } from '@nestjs/common';
import { Prisma, RoadTreasuryBucket, RoadTreasuryEventType } from '@prisma/client';

@Injectable()
export class RoadTreasuryService {
  readonly seasonCode = 'WC2026';

  async record(
    tx: Prisma.TransactionClient,
    input: {
      eventType: RoadTreasuryEventType;
      eventId: string;
      entries: Array<{
        entryKey?: string;
        bucket: RoadTreasuryBucket;
        amount: bigint;
        poolId?: string | null;
        purchaseId?: string | null;
        sponsorLedgerId?: string | null;
        dividendId?: string | null;
        meta?: any;
      }>;
      meta?: any;
    },
  ) {
    const data = input.entries
      .filter((e) => e.amount !== 0n)
      .map((e) => ({
        seasonCode: this.seasonCode,
        eventType: input.eventType,
        eventId: input.eventId,
        entryKey:
          e.entryKey ??
          [e.bucket, e.poolId ?? '', e.purchaseId ?? '', e.sponsorLedgerId ?? '', e.dividendId ?? ''].join('|'),
        bucket: e.bucket,
        amount: e.amount,
        poolId: e.poolId ?? null,
        purchaseId: e.purchaseId ?? null,
        sponsorLedgerId: e.sponsorLedgerId ?? null,
        dividendId: e.dividendId ?? null,
        meta: e.meta ? { ...input.meta, ...e.meta } : input.meta ?? undefined,
      }));

    if (data.length === 0) return;

    await tx.roadTreasuryLedger.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async getBalances(tx: Prisma.TransactionClient) {
    const rows = await tx.roadTreasuryLedger.groupBy({
      by: ['bucket'],
      where: { seasonCode: this.seasonCode },
      _sum: { amount: true },
    });

    const map = new Map<RoadTreasuryBucket, bigint>();
    for (const r of rows) {
      map.set(r.bucket, r._sum.amount ?? 0n);
    }

    const get = (b: RoadTreasuryBucket) => map.get(b) ?? 0n;

    const reserveBalance = get(RoadTreasuryBucket.RESERVE);
    const pendingRewardLiability = get(RoadTreasuryBucket.PENDING_REWARD);
    const superJackpot = get(RoadTreasuryBucket.SUPER_JACKPOT);
    const platformFeeIncome = get(RoadTreasuryBucket.PLATFORM_FEE);
    const platformCarry = get(RoadTreasuryBucket.PLATFORM_CARRY);
    const officialSponsorCost = get(RoadTreasuryBucket.OFFICIAL_SPONSOR_COST);

    const reserveCoverageRatio =
      pendingRewardLiability > 0n ? Number(reserveBalance) / Number(pendingRewardLiability) : 1;

    const reserveSurplus =
      reserveBalance > pendingRewardLiability ? reserveBalance - pendingRewardLiability : 0n;

    const pendingRewardLiabilityRisk =
      pendingRewardLiability > reserveBalance ? pendingRewardLiability - reserveBalance : 0n;

    const netProfit =
      platformFeeIncome +
      platformCarry +
      reserveSurplus -
      officialSponsorCost -
      pendingRewardLiabilityRisk;

    return {
      platformFeeIncome,
      platformCarry,
      officialSponsorCost,
      reserveBalance,
      pendingRewardLiability,
      superJackpot,
      reserveCoverageRatio,
      reserveSurplus,
      pendingRewardLiabilityRisk,
      netProfit,
    };
  }

  async getBucketTotals(tx: Prisma.TransactionClient) {
    const rows = await tx.roadTreasuryLedger.groupBy({
      by: ['bucket'],
      where: { seasonCode: this.seasonCode },
      _sum: { amount: true },
    });
    return rows.map((r) => ({ bucket: r.bucket, amount: r._sum.amount ?? 0n }));
  }

  async listEntries(
    tx: Prisma.TransactionClient,
    input: {
      bucket?: RoadTreasuryBucket;
      eventType?: RoadTreasuryEventType;
      eventId?: string;
      poolId?: string;
      limit?: number;
    },
  ) {
    const where: any = { seasonCode: this.seasonCode };
    if (input.bucket) where.bucket = input.bucket;
    if (input.eventType) where.eventType = input.eventType;
    if (input.eventId) where.eventId = input.eventId;
    if (input.poolId) where.poolId = input.poolId;

    const take = Math.min(Math.max(Number(input.limit || 50), 1), 200);
    return tx.roadTreasuryLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async reconcile(tx: Prisma.TransactionClient) {
    const [bucketTotals, superJackpot, superSumRow] = await Promise.all([
      this.getBucketTotals(tx),
      tx.superJackpot.findUnique({ where: { seasonCode: this.seasonCode } }),
      tx.roadTreasuryLedger.aggregate({
        where: { seasonCode: this.seasonCode, bucket: RoadTreasuryBucket.SUPER_JACKPOT },
        _sum: { amount: true },
      }),
    ]);

    const ledgerSuper = superSumRow._sum.amount ?? 0n;
    const dbSuper = superJackpot?.amount ?? 0n;
    const superDiff = dbSuper - ledgerSuper;

    const orphanPools = await tx.$queryRaw<Array<any>>`
      SELECT l.id, l."eventType" AS event_type, l."eventId" AS event_id, l."entryKey" AS entry_key,
             l.bucket, l.amount, l."poolId" AS pool_id
      FROM road_treasury_ledger l
      LEFT JOIN road_pools p ON p.id = l."poolId"
      WHERE l."seasonCode" = ${this.seasonCode}
        AND l."poolId" IS NOT NULL
        AND p.id IS NULL
      ORDER BY l."createdAt" DESC
      LIMIT 50
    `;
    const orphanPurchases = await tx.$queryRaw<Array<any>>`
      SELECT l.id, l."eventType" AS event_type, l."eventId" AS event_id, l."entryKey" AS entry_key,
             l.bucket, l.amount, l."purchaseId" AS purchase_id
      FROM road_treasury_ledger l
      LEFT JOIN road_purchases p ON p.id = l."purchaseId"
      WHERE l."seasonCode" = ${this.seasonCode}
        AND l."purchaseId" IS NOT NULL
        AND p.id IS NULL
      ORDER BY l."createdAt" DESC
      LIMIT 50
    `;
    const orphanSponsors = await tx.$queryRaw<Array<any>>`
      SELECT l.id, l."eventType" AS event_type, l."eventId" AS event_id, l."entryKey" AS entry_key,
             l.bucket, l.amount, l."sponsorLedgerId" AS sponsor_ledger_id
      FROM road_treasury_ledger l
      LEFT JOIN sponsor_ledger s ON s.id = l."sponsorLedgerId"
      WHERE l."seasonCode" = ${this.seasonCode}
        AND l."sponsorLedgerId" IS NOT NULL
        AND s.id IS NULL
      ORDER BY l."createdAt" DESC
      LIMIT 50
    `;
    const orphanDividends = await tx.$queryRaw<Array<any>>`
      SELECT l.id, l."eventType" AS event_type, l."eventId" AS event_id, l."entryKey" AS entry_key,
             l.bucket, l.amount, l."dividendId" AS dividend_id
      FROM road_treasury_ledger l
      LEFT JOIN road_dividends d ON d.id = l."dividendId"
      WHERE l."seasonCode" = ${this.seasonCode}
        AND l."dividendId" IS NOT NULL
        AND d.id IS NULL
      ORDER BY l."createdAt" DESC
      LIMIT 50
    `;

    const poolPrizeDiffs = await tx.$queryRaw<Array<any>>`
      WITH ledger AS (
        SELECT "poolId" AS pool_id, COALESCE(SUM(amount), 0) AS ledger_prize
        FROM road_treasury_ledger
        WHERE "seasonCode" = ${this.seasonCode} AND bucket = 'POOL_PRIZE' AND "poolId" IS NOT NULL
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

    const pendingDiffs = await tx.$queryRaw<Array<any>>`
      WITH holding AS (
        SELECT "poolId" AS pool_id, COALESCE(SUM("pendingReward"), 0) AS holding_pending
        FROM road_key_holdings
        GROUP BY "poolId"
      ),
      ledger AS (
        SELECT "poolId" AS pool_id, COALESCE(SUM(amount), 0) AS ledger_pending
        FROM road_treasury_ledger
        WHERE "seasonCode" = ${this.seasonCode} AND bucket = 'PENDING_REWARD' AND "poolId" IS NOT NULL
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

    const ok =
      orphanPools.length === 0 &&
      orphanPurchases.length === 0 &&
      orphanSponsors.length === 0 &&
      orphanDividends.length === 0 &&
      poolPrizeDiffs.length === 0 &&
      pendingDiffs.length === 0 &&
      superDiff === 0n;

    return {
      ok,
      seasonCode: this.seasonCode,
      bucketTotals,
      orphan: {
        pools: orphanPools,
        purchases: orphanPurchases,
        sponsors: orphanSponsors,
        dividends: orphanDividends,
      },
      diffs: {
        poolPrize: poolPrizeDiffs,
        pendingReward: pendingDiffs,
        superJackpot: {
          db: dbSuper,
          treasury: ledgerSuper,
          diff: superDiff,
        },
      },
    };
  }
}
