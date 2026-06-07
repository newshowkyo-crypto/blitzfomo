import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ConfigService } from '../config/config.service';
import { RiskService } from '../risk/risk.service';
import { RoadPricingService } from './road-pricing.service';
import { RoadDividendService } from './road-dividend.service';
import { RoadEconomyService } from './road-economy.service';
import { Prisma, RoadStage, RoadTreasuryBucket, RoadTreasuryEventType } from '@prisma/client';
import { SystemLogService } from '../system-log/system-log.service';
import { RoadTreasuryService } from './road-treasury.service';

function isBotUser(user: { walletAddress: string; nickname: string | null }) {
  const wallet = (user.walletAddress || '').toLowerCase();
  const nickname = (user.nickname || '').toLowerCase();
  return wallet.startsWith('bot:') || wallet.startsWith('0xbot') || nickname.startsWith('bot_');
}

function parseStage(stage?: string): RoadStage | undefined {
  if (!stage) return undefined;
  const v = stage.toUpperCase();
  return (RoadStage as any)[v] as RoadStage | undefined;
}

@Injectable()
export class RoadPurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly config: ConfigService,
    private readonly risk: RiskService,
    private readonly pricing: RoadPricingService,
    private readonly dividend: RoadDividendService,
    private readonly economy: RoadEconomyService,
    private readonly systemLog: SystemLogService,
    private readonly treasury: RoadTreasuryService,
  ) {}

  async getState() {
    const [jackpot, totals, sponsored, roadConfig] = await Promise.all([
      this.prisma.superJackpot.findUnique({ where: { seasonCode: 'WC2026' } }),
      this.prisma.roadPurchase.aggregate({ _sum: { amount: true } }),
      this.prisma.sponsorLedger.aggregate({ _sum: { amount: true } }),
      this.config.getRoadConfig('WC2026'),
    ]);

    return {
      seasonCode: 'WC2026',
      superJackpot: Number(jackpot?.amount ?? 0n) / 100,
      totalPurchases: Number(totals._sum.amount ?? 0n) / 100,
      officialSponsored: Number(sponsored._sum.amount ?? 0n) / 100,
      roadConfig: roadConfig
        ? {
            baseHouseFeeBps: roadConfig.baseHouseFeeBps,
            maxHouseFeeBps: roadConfig.maxHouseFeeBps,
            baseDividendBps: roadConfig.baseDividendBps,
            prizeBps: roadConfig.prizeBps,
            superBps: roadConfig.superBps,
            reinvestBps: roadConfig.reinvestBps,
            agentBps: roadConfig.agentBps,
            reserveBps: roadConfig.reserveBps,
            releaseDelayHours: roadConfig.releaseDelayHours,
            lowCoverageThresholdBps: roadConfig.lowCoverageThresholdBps,
          }
        : null,
      timestamp: new Date(),
    };
  }

  async listTeams() {
    const teams = await this.prisma.team.findMany({
      orderBy: { code: 'asc' },
    });
    return teams;
  }

  async listPools(filter: { stage?: string; teamCode?: string }) {
    const stage = parseStage(filter.stage);
    const where: any = {};
    if (stage) where.stage = stage;
    if (filter.teamCode) where.team = { code: filter.teamCode.toUpperCase() };

    const pools = await this.prisma.roadPool.findMany({
      where,
      include: { team: true },
      orderBy: [{ stage: 'asc' }, { team: { code: 'asc' } }],
      take: 500,
    });

    return pools.map((p) => ({
      ...p,
      soldKeys: Number(p.soldKeys),
      basePrice: Number(p.basePrice) / 100,
      currentPrice: Number(p.currentPrice) / 100,
      prizePool: Number(p.prizePool) / 100,
      dividendPaid: Number(p.dividendPaid) / 100,
      sponsorAmount: Number(p.sponsorAmount) / 100,
    }));
  }

  async getPool(id: string) {
    const pool = await this.prisma.roadPool.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!pool) throw new BadRequestException('Pool not found');
    return {
      ...pool,
      soldKeys: Number(pool.soldKeys),
      basePrice: Number(pool.basePrice) / 100,
      currentPrice: Number(pool.currentPrice) / 100,
      prizePool: Number(pool.prizePool) / 100,
      dividendPaid: Number(pool.dividendPaid) / 100,
      sponsorAmount: Number(pool.sponsorAmount) / 100,
    };
  }

  async getFeed() {
    const [purchases, sponsors] = await Promise.all([
      this.prisma.roadPurchase.findMany({
        include: { user: { select: { nickname: true } }, pool: { include: { team: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.sponsorLedger.findMany({
        include: { pool: { include: { team: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const events: any[] = [];
    for (const p of purchases) {
      events.push({
        type: 'purchase',
        createdAt: p.createdAt,
        nickname: p.user.nickname || 'Player',
        team: p.pool.team.code,
        stage: p.pool.stage,
        amount: Number(p.amount) / 100,
      });
    }
    for (const s of sponsors) {
      events.push({
        type: 'sponsor',
        createdAt: s.createdAt,
        nickname: 'Official Sponsored',
        team: s.pool.team.code,
        stage: s.pool.stage,
        amount: Number(s.amount) / 100,
      });
    }

    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return events.slice(0, 30);
  }

  async getMyHoldings(userId: string) {
    const holdings = await this.prisma.roadKeyHolding.findMany({
      where: { userId },
      include: { pool: { include: { team: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return holdings.map((h) => ({
      ...h,
      keyAmount: Number(h.keyAmount),
      costAmount: Number(h.costAmount) / 100,
      avgEntryPrice: Number(h.avgEntryPrice) / 100,
      pendingReward: Number(h.pendingReward) / 100,
      releasedReward: Number(h.releasedReward) / 100,
      pool: {
        ...h.pool,
        soldKeys: Number(h.pool.soldKeys),
        basePrice: Number(h.pool.basePrice) / 100,
        currentPrice: Number(h.pool.currentPrice) / 100,
        prizePool: Number(h.pool.prizePool) / 100,
        dividendPaid: Number(h.pool.dividendPaid) / 100,
        sponsorAmount: Number(h.pool.sponsorAmount) / 100,
      },
    }));
  }

  async getMyDividends(userId: string) {
    const items = await this.prisma.roadDividend.findMany({
      where: { userId },
      include: { pool: { include: { team: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return items.map((d) => ({
      ...d,
      amount: Number(d.amount) / 100,
      weight: Number(d.weight),
      pool: {
        ...d.pool,
        soldKeys: Number(d.pool.soldKeys),
        basePrice: Number(d.pool.basePrice) / 100,
        currentPrice: Number(d.pool.currentPrice) / 100,
        prizePool: Number(d.pool.prizePool) / 100,
      },
    }));
  }

  async purchase(input: { userId: string; poolId: string; amount: bigint; idempotencyKey?: string; referralCode?: string }) {
    if (input.amount <= 0n) {
      throw new BadRequestException('Amount must be positive');
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.roadPurchase.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { userId: true },
      });
      if (existing) {
        if (existing.userId !== input.userId) throw new BadRequestException('Invalid idempotency key');
        const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { balance: true } });
        if (!user) throw new BadRequestException('User not found');
        return { success: true, duplicate: true, balance: Number(user.balance) / 100 };
      }
    }

    const minBuy = await this.config.getMinBuyAmount();
    if (input.amount < minBuy) {
      throw new BadRequestException({ code: 40003, message: `Purchase amount cannot be lower than ${Number(minBuy) / 100} BF` });
    }

    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.isFrozen) throw new BadRequestException('User is frozen');
    if (isBotUser(user)) throw new BadRequestException('Bot cannot purchase Road Key');

    const roadConfig = await this.config.getRoadConfig('WC2026');
    if (!roadConfig) throw new BadRequestException('Road config not initialized');

    if (user.balance < input.amount) {
      throw new BadRequestException({ code: 40005, message: 'Insufficient balance' });
    }

    const riskCheck = await this.risk.checkPurchaseRisk(input.userId, input.amount);
    if (!riskCheck.allowed) {
      throw new BadRequestException({ code: 40004, message: riskCheck.reason });
    }

    const one = 10000n;

    const now = new Date();

    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM road_pools WHERE id = ${input.poolId} FOR UPDATE`;
        const pool = await tx.roadPool.findUnique({
          where: { id: input.poolId },
          include: { team: true },
        });
        if (!pool) throw new BadRequestException('Pool not found');
        if (pool.status !== 'OPEN') throw new BadRequestException('Pool not open');
        if (process.env.NODE_ENV === 'production' && !pool.closeAt) {
          throw new BadRequestException('Pool closeAt required');
        }
        if (pool.openAt && pool.openAt.getTime() > now.getTime()) {
          throw new BadRequestException('Pool not opened yet');
        }
        if (pool.closeAt && pool.closeAt.getTime() <= now.getTime()) throw new BadRequestException('Pool already closed');

        const params = (pool.params || {}) as any;
        
        const [balances, economyResult] = await Promise.all([
          this.treasury.getBalances(tx),
          this.economy.calculateDynamicEconomy(pool.stage),
        ]);

        const hBps = Number(economyResult.finalHouseFeeBps);
        const dBps = Number(economyResult.finalDividendBps);
        const sBps = Number(economyResult.finalSuperBps);
        const zBps = Number(economyResult.finalReserveBps);
        const rBps = Number(roadConfig.reinvestBps);
        const kBps = Number(roadConfig.agentBps);
        const dRBps = Number(roadConfig.dailyRushBps);
        const mBps = Number(roadConfig.megaPoolBps);
        const minDividendBps = Number(roadConfig.minDividendBps);

        let finalDailyRushBps = dRBps;
        let finalMegaPoolBps = mBps;
        let finalDividendBps = dBps;

        let fixed = dBps + sBps + zBps + rBps + kBps + dRBps + mBps;
        
        if (fixed > 10000) {
          let over = fixed - 10000;
          
          if (over > 0 && finalDailyRushBps > 0) {
            const cutDaily = Math.min(over, finalDailyRushBps);
            finalDailyRushBps -= cutDaily;
            over -= cutDaily;
          }
          
          if (over > 0 && finalMegaPoolBps > 0) {
            const cutMega = Math.min(over, finalMegaPoolBps);
            finalMegaPoolBps -= cutMega;
            over -= cutMega;
          }
          
          if (over > 0 && finalDividendBps > minDividendBps) {
            const cutDividend = Math.min(over, finalDividendBps - minDividendBps);
            finalDividendBps -= cutDividend;
            over -= cutDividend;
          }
          
          fixed = finalDividendBps + sBps + zBps + rBps + kBps + finalDailyRushBps + finalMegaPoolBps;
        }
        
        if (fixed > 10000) {
          throw new BadRequestException(`Dynamic allocation failed: fixed bps (${fixed}) exceeds 10000 after max reduction`);
        }
        
        const pBps = 10000 - fixed;
        
        const totalNetBps = pBps + finalDividendBps + sBps + zBps + rBps + kBps + finalDailyRushBps + finalMegaPoolBps;
        if (totalNetBps !== 10000) {
          throw new BadRequestException(`Dynamic allocation failed: totalNetBps (${totalNetBps}) != 10000`);
        }

        const releaseDelayHours = economyResult.releaseDelayHours;

        const { price: priceSnapshot, meta: priceMeta } = this.pricing.calculate(pool, pool.team, now);
        const keyAmount = new Prisma.Decimal(input.amount.toString()).div(new Prisma.Decimal(priceSnapshot.toString()));

        const houseFee = (input.amount * BigInt(hBps)) / one;
        const net = input.amount - houseFee;
        
        const prizePart = (net * BigInt(pBps)) / one;
        const dividendPart = (net * BigInt(finalDividendBps)) / one;
        const superPart = (net * BigInt(sBps)) / one;
        const reinvestPart = (net * BigInt(rBps)) / one;
        const agentPart = (net * BigInt(kBps)) / one;
        const reservePart = (net * BigInt(zBps)) / one;
        const dailyRushPart = (net * BigInt(finalDailyRushBps)) / one;
        const megaPoolPart = (net * BigInt(finalMegaPoolBps)) / one;

        const soldBefore = pool.soldKeys;
        const soldAfter = soldBefore.add(keyAmount);

        const updatedPoolForPricing = { ...pool, soldKeys: soldAfter };
        const { price: nextPrice } = this.pricing.calculate(updatedPoolForPricing as any, pool.team, now);

        const updatedPool = await tx.roadPool.update({
          where: { id: pool.id },
          data: {
            soldKeys: { increment: keyAmount },
            totalPurchases: { increment: input.amount },
            prizePool: { increment: prizePart },
            superPoolContrib: { increment: superPart },
            reserveContrib: { increment: reservePart },
            currentPrice: nextPrice,
          },
        });

        await tx.superJackpot.upsert({
          where: { seasonCode: 'WC2026' },
          create: { seasonCode: 'WC2026', amount: superPart, status: 'ACTIVE' },
          update: { amount: { increment: superPart } },
        });

        const existingHolding = await tx.roadKeyHolding.findUnique({
          where: { userId_poolId: { userId: input.userId, poolId: pool.id } },
        });

        const genesisCount = Number(params.genesisCount ?? 0);
        const genesisBoost = Number(params.genesisBoost ?? 1.0);

        let holdingId: string;
        if (!existingHolding) {
          const isGenesis = genesisCount > 0 && Number(soldBefore) < genesisCount;
          const created = await tx.roadKeyHolding.create({
            data: {
              userId: input.userId,
              poolId: pool.id,
              keyAmount,
              costAmount: input.amount,
              avgEntryPrice: priceSnapshot,
              genesisBoost: isGenesis ? new Prisma.Decimal(genesisBoost.toString()) : new Prisma.Decimal('1.0'),
              pendingReward: 0n,
              releasedReward: 0n,
              status: 'ACTIVE',
            },
          });
          holdingId = created.id;
        } else {
          const newKeyAmount = existingHolding.keyAmount.add(keyAmount);
          const newCost = existingHolding.costAmount + input.amount;
          const avg = new Prisma.Decimal(newCost.toString()).div(newKeyAmount);
          const avgInt = BigInt(avg.toFixed(0));
          const updatedHolding = await tx.roadKeyHolding.update({
            where: { id: existingHolding.id },
            data: {
              keyAmount: newKeyAmount,
              costAmount: newCost,
              avgEntryPrice: avgInt,
              status: 'ACTIVE',
            },
          });
          holdingId = updatedHolding.id;
        }

        const purchase = await tx.roadPurchase.create({
          data: {
            userId: input.userId,
            poolId: pool.id,
            amount: input.amount,
            keyAmount,
            priceSnapshot,
            houseFee,
            prizePart,
            dividendPart,
            superPart,
            reinvestPart,
            agentPart,
            reservePart,
            referralCode: input.referralCode || null,
            idempotencyKey: input.idempotencyKey || null,
          },
        });

        const beta = Number(params.beta ?? 0.08);
        const ageBoostCap = Number(params.ageBoostCap ?? 1.35);

        if (input.referralCode) {
          const referralCode = String(input.referralCode).trim();
          const kol = await tx.roadKol.findUnique({ where: { referralCode } });
          if (kol && kol.seasonCode === 'WC2026' && kol.status === 'ACTIVE') {
            const inviterId = kol.inviterId;
            if (inviterId !== input.userId) {
              const inviter = await tx.user.findUnique({ where: { id: inviterId } });
              if (inviter && !isBotUser(inviter) && agentPart > 0n) {
                await tx.roadReferralCommission.create({
                  data: {
                    seasonCode: 'WC2026',
                    referralCode,
                    inviterId,
                    referredUserId: input.userId,
                    purchaseId: purchase.id,
                    commissionAmount: agentPart,
                    status: 'PENDING',
                    releaseAt: new Date(now.getTime() + releaseDelayHours * 3600000),
                  },
                });
              }
            }
          }
        }

        const dividendResult = await this.dividend.distributeFromPurchase(tx, {
          poolId: pool.id,
          purchaseId: purchase.id,
          buyerUserId: input.userId,
          dividendBudget: dividendPart,
          currentPrice: priceSnapshot,
          releaseDelayHours,
          beta,
          ageBoostCap,
          now,
        });

        let dividendPartApplied = dividendPart;
        let reservePartApplied = reservePart;
        if (dividendResult.distributed < dividendPart) {
          const remainder = dividendPart - dividendResult.distributed;
          dividendPartApplied = dividendResult.distributed;
          reservePartApplied = reservePart + remainder;

          await tx.roadPool.update({
            where: { id: pool.id },
            data: { reserveContrib: { increment: remainder } },
          });
          await tx.roadPurchase.update({
            where: { id: purchase.id },
            data: {
              dividendPart: { decrement: remainder },
              reservePart: { increment: remainder },
            },
          });
        }

        if (dividendResult.distributed > 0n) {
          await tx.roadPool.update({
            where: { id: pool.id },
            data: { dividendPaid: { increment: dividendResult.distributed } },
          });
        }

        const treasuryEntries: any[] = [
            { bucket: RoadTreasuryBucket.PLATFORM_FEE, amount: houseFee, poolId: pool.id, purchaseId: purchase.id },
            { bucket: RoadTreasuryBucket.POOL_PRIZE, amount: prizePart, poolId: pool.id, purchaseId: purchase.id },
            { bucket: RoadTreasuryBucket.PENDING_REWARD, amount: dividendResult.distributed, poolId: pool.id, purchaseId: purchase.id },
            { bucket: RoadTreasuryBucket.SUPER_JACKPOT, amount: superPart, poolId: pool.id, purchaseId: purchase.id },
            { bucket: RoadTreasuryBucket.REINVEST_POOL, amount: reinvestPart, poolId: pool.id, purchaseId: purchase.id },
            { bucket: RoadTreasuryBucket.AGENT_POOL, amount: agentPart, poolId: pool.id, purchaseId: purchase.id },
            { bucket: RoadTreasuryBucket.RESERVE, amount: reservePartApplied, poolId: pool.id, purchaseId: purchase.id },
          ];
          
          if (dailyRushPart > 0n) {
            treasuryEntries.push({ bucket: RoadTreasuryBucket.ACTIVITY_BUDGET, amount: dailyRushPart, poolId: pool.id, purchaseId: purchase.id, meta: { type: 'dailyRush' } });
          }
          if (megaPoolPart > 0n) {
            treasuryEntries.push({ bucket: RoadTreasuryBucket.ACTIVITY_BUDGET, amount: megaPoolPart, poolId: pool.id, purchaseId: purchase.id, meta: { type: 'megaPool' } });
          }
          
          await this.treasury.record(tx, {
            eventType: RoadTreasuryEventType.PURCHASE,
            eventId: purchase.id,
            entries: treasuryEntries,
            meta: {
              economyMode: economyResult.economyMode,
              finalHouseFeeBps: hBps,
              finalDividendBps: finalDividendBps,
              finalSuperBps: sBps,
              finalReserveBps: zBps,
              finalPrizeBps: pBps,
              finalReinvestBps: rBps,
              finalAgentBps: kBps,
              finalDailyRushBps: finalDailyRushBps,
              finalMegaPoolBps: finalMegaPoolBps,
              totalNetBps: totalNetBps,
            },
          });

        const ledgerResult = await this.ledger.applyLedgerTx(tx, {
          userId: input.userId,
          type: 'PURCHASE',
          amount: -input.amount,
          description: `Road key purchase ${pool.team.code}.${pool.stage}`,
          meta: {
            poolId: pool.id,
            teamCode: pool.team.code,
            stage: pool.stage,
            priceSnapshot: priceSnapshot.toString(),
            nextPrice: nextPrice.toString(),
            keyAmount: keyAmount.toString(),
            parts: {
              houseFee: houseFee.toString(),
              prizePart: prizePart.toString(),
              dividendPart: dividendPartApplied.toString(),
              superPart: superPart.toString(),
              reinvestPart: reinvestPart.toString(),
              agentPart: agentPart.toString(),
              reservePart: reservePartApplied.toString(),
              dailyRushPart: dailyRushPart.toString(),
              megaPoolPart: megaPoolPart.toString(),
            },
            bps: {
              h: hBps.toString(),
              p: pBps.toString(),
              d: finalDividendBps.toString(),
              s: sBps.toString(),
              r: rBps.toString(),
              k: kBps.toString(),
              z: zBps.toString(),
              dr: finalDailyRushBps.toString(),
              m: finalMegaPoolBps.toString(),
              totalNet: totalNetBps.toString(),
            },
            economy: {
              economyMode: economyResult.economyMode,
              growthFactor: economyResult.growthFactor,
              poolHealthFactor: economyResult.poolHealthFactor,
              retentionFactor: economyResult.retentionFactor,
              stageFactor: economyResult.stageFactor,
              finalHouseFeeBps: hBps,
              finalDividendBps: finalDividendBps,
              finalSuperBps: sBps,
              finalReserveBps: zBps,
              finalPrizeBps: pBps,
              finalReinvestBps: rBps,
              finalAgentBps: kBps,
              finalDailyRushBps: finalDailyRushBps,
              finalMegaPoolBps: finalMegaPoolBps,
              totalNetBps: totalNetBps,
              releaseDelayHours: economyResult.releaseDelayHours,
            },
            pricing: priceMeta,
          },
        });

        return {
          balanceAfter: ledgerResult.balanceAfter,
          pool: updatedPool,
          purchaseId: purchase.id,
          holdingId,
          keyAmount: Number(keyAmount),
          price: Number(priceSnapshot) / 100,
          dividendDistributed: Number(dividendResult.distributed) / 100,
        };
      });

      await this.systemLog.info('road', 'Road key purchased', {
        userId: input.userId,
        poolId: input.poolId,
        amount: input.amount,
        purchaseId: txResult.purchaseId,
        keyAmount: txResult.keyAmount,
      });

      return {
        success: true,
        balance: Number(txResult.balanceAfter) / 100,
        purchaseId: txResult.purchaseId,
        keyAmount: txResult.keyAmount,
        price: txResult.price,
        dividendDistributed: txResult.dividendDistributed,
      };
    } catch (error: any) {
      if (input.idempotencyKey && error?.code === 'P2002') {
        const latest = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { balance: true } });
        if (!latest) throw new BadRequestException('User not found');
        return { success: true, duplicate: true, balance: Number(latest.balance) / 100 };
      }
      throw error;
    }
  }

  async getAdminOverview() {
    const [purchaseAgg, sponsorAgg, pendingAgg, superJackpot, treasury, roadConfig, economyResult] = await Promise.all([
      this.prisma.roadPurchase.aggregate({ _sum: { amount: true } }),
      this.prisma.sponsorLedger.aggregate({ _sum: { amount: true } }),
      this.prisma.roadKeyHolding.aggregate({ _sum: { pendingReward: true } }),
      this.prisma.superJackpot.findUnique({ where: { seasonCode: 'WC2026' } }),
      this.prisma.$transaction((tx) => this.treasury.getBalances(tx)),
      this.config.getRoadConfig('WC2026'),
      this.economy.getEconomyOverview(),
    ]);

    const pending = pendingAgg._sum.pendingReward ?? 0n;
    const reserveCoverageRatio = pending > 0n ? Number(treasury.reserveBalance) / Number(pending) : 1;

    return {
      totalPurchases: Number(purchaseAgg._sum.amount ?? 0n) / 100,
      officialSponsored: Number(sponsorAgg._sum.amount ?? 0n) / 100,
      pendingRewardLiability: Number(pending) / 100,
      roadConfig: roadConfig
        ? {
            economyMode: roadConfig.economyMode,
            baseHouseFeeBps: roadConfig.baseHouseFeeBps,
            minHouseFeeBps: roadConfig.minHouseFeeBps,
            maxHouseFeeBps: roadConfig.maxHouseFeeBps,
            baseDividendBps: roadConfig.baseDividendBps,
            minDividendBps: roadConfig.minDividendBps,
            maxDividendBps: roadConfig.maxDividendBps,
            prizeBps: roadConfig.prizeBps,
            superBps: roadConfig.superBps,
            minSuperBps: roadConfig.minSuperBps,
            maxSuperBps: roadConfig.maxSuperBps,
            reinvestBps: roadConfig.reinvestBps,
            agentBps: roadConfig.agentBps,
            reserveBps: roadConfig.reserveBps,
            minReserveBps: roadConfig.minReserveBps,
            maxReserveBps: roadConfig.maxReserveBps,
            releaseDelayHours: roadConfig.releaseDelayHours,
            releaseDelayMinHours: roadConfig.releaseDelayMinHours,
            releaseDelayMaxHours: roadConfig.releaseDelayMaxHours,
            lowCoverageThresholdBps: roadConfig.lowCoverageThresholdBps,
            withdrawalPressureThresholdBps: roadConfig.withdrawalPressureThresholdBps,
            volumeGrowthBoostCapBps: roadConfig.volumeGrowthBoostCapBps,
          }
        : null,
      platformFeeIncome: Number(treasury.platformFeeIncome) / 100,
      platformCarry: Number(treasury.platformCarry) / 100,
      officialSponsorCost: Number(treasury.officialSponsorCost) / 100,
      reserveBalance: Number(treasury.reserveBalance) / 100,
      reserveCoverageRatio: Number.isFinite(reserveCoverageRatio) ? reserveCoverageRatio : 0,
      pendingRewardLiabilityRisk: Number(treasury.pendingRewardLiabilityRisk) / 100,
      reserveSurplus: Number(treasury.reserveSurplus) / 100,
      netProfit: Number(treasury.netProfit) / 100,
      superJackpot: Number(superJackpot?.amount ?? 0n) / 100,
      economy: economyResult,
      finalPrizeBps: economyResult?.finalPrizeBps ?? 0,
      finalDailyRushBps: economyResult?.finalDailyRushBps ?? 0,
      finalMegaPoolBps: economyResult?.finalMegaPoolBps ?? 0,
      totalNetBps: economyResult?.totalNetBps ?? 0,
      timestamp: new Date(),
    };
  }

  async adminListPools(filter: { status?: string; stage?: string; teamId?: string }) {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    const stage = parseStage(filter.stage);
    if (stage) where.stage = stage;
    if (filter.teamId) where.teamId = filter.teamId;
    const pools = await this.prisma.roadPool.findMany({
      where,
      include: { team: true },
      orderBy: [{ stage: 'asc' }, { team: { code: 'asc' } }],
      take: 2000,
    });
    return pools;
  }

  async createTeam(operatorAdminId: string, body: any) {
    const created = await this.prisma.team.create({
      data: {
        code: String(body.code || '').toUpperCase(),
        name: String(body.name || ''),
        flagUrl: body.flagUrl ? String(body.flagUrl) : null,
        groupCode: body.groupCode ? String(body.groupCode) : null,
        strengthFactor: body.strengthFactor ?? '1.0',
        impliedTop32: body.impliedTop32 ?? null,
        impliedTop16: body.impliedTop16 ?? null,
        impliedTop8: body.impliedTop8 ?? null,
        impliedTop4: body.impliedTop4 ?? null,
        impliedFinal: body.impliedFinal ?? null,
        impliedChampion: body.impliedChampion ?? null,
        status: body.status || 'ACTIVE',
        currentStage: body.currentStage || 'GROUP',
      },
    });
    await this.systemLog.info('road', 'Team created', { operatorAdminId, teamId: created.id });
    return created;
  }

  async updateTeam(operatorAdminId: string, id: string, body: any) {
    const updated = await this.prisma.team.update({
      where: { id },
      data: {
        code: body.code !== undefined ? String(body.code || '').toUpperCase() : undefined,
        name: body.name !== undefined ? String(body.name || '') : undefined,
        flagUrl: body.flagUrl !== undefined ? (body.flagUrl ? String(body.flagUrl) : null) : undefined,
        groupCode: body.groupCode !== undefined ? (body.groupCode ? String(body.groupCode) : null) : undefined,
        strengthFactor: body.strengthFactor !== undefined ? body.strengthFactor : undefined,
        impliedTop32: body.impliedTop32 !== undefined ? body.impliedTop32 : undefined,
        impliedTop16: body.impliedTop16 !== undefined ? body.impliedTop16 : undefined,
        impliedTop8: body.impliedTop8 !== undefined ? body.impliedTop8 : undefined,
        impliedTop4: body.impliedTop4 !== undefined ? body.impliedTop4 : undefined,
        impliedFinal: body.impliedFinal !== undefined ? body.impliedFinal : undefined,
        impliedChampion: body.impliedChampion !== undefined ? body.impliedChampion : undefined,
        status: body.status !== undefined ? body.status : undefined,
        currentStage: body.currentStage !== undefined ? body.currentStage : undefined,
      },
    });
    await this.systemLog.info('road', 'Team updated', { operatorAdminId, teamId: updated.id });
    return updated;
  }

  async createPool(operatorAdminId: string, body: any) {
    const stage = parseStage(body.stage);
    if (!stage) throw new BadRequestException('Invalid stage');
    const status = body.status || 'DRAFT';
    const openAt = body.openAt ? new Date(body.openAt) : null;
    const closeAt = body.closeAt ? new Date(body.closeAt) : null;
    if (openAt && closeAt && closeAt.getTime() <= openAt.getTime()) {
      throw new BadRequestException('Invalid openAt/closeAt');
    }
    if (process.env.NODE_ENV === 'production' && status === 'OPEN' && (!openAt || !closeAt)) {
      throw new BadRequestException('openAt/closeAt required for OPEN pool');
    }

    const sponsorBudgetLimit =
      body.sponsorBudgetLimit === undefined ? 50000n : BigInt(body.sponsorBudgetLimit || 0);

    const created = await this.prisma.roadPool.create({
      data: {
        teamId: String(body.teamId),
        stage,
        status,
        basePrice: BigInt(body.basePrice),
        currentPrice: BigInt(body.currentPrice ?? body.basePrice),
        sponsorBudgetLimit,
        openAt,
        closeAt,
        params: body.params ?? undefined,
      },
    });
    await this.systemLog.info('road', 'Pool created', { operatorAdminId, poolId: created.id });
    return created;
  }

  async updatePool(operatorAdminId: string, id: string, body: any) {
    const existing = await this.prisma.roadPool.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Pool not found');

    const status = body.status !== undefined ? body.status : existing.status;
    const openAt = body.openAt !== undefined ? (body.openAt ? new Date(body.openAt) : null) : existing.openAt;
    const closeAt = body.closeAt !== undefined ? (body.closeAt ? new Date(body.closeAt) : null) : existing.closeAt;
    if (openAt && closeAt && closeAt.getTime() <= openAt.getTime()) {
      throw new BadRequestException('Invalid openAt/closeAt');
    }
    if (process.env.NODE_ENV === 'production' && status === 'OPEN' && (!openAt || !closeAt)) {
      throw new BadRequestException('openAt/closeAt required for OPEN pool');
    }

    const updated = await this.prisma.roadPool.update({
      where: { id },
      data: {
        status: body.status !== undefined ? body.status : undefined,
        basePrice: body.basePrice !== undefined ? BigInt(body.basePrice) : undefined,
        currentPrice: body.currentPrice !== undefined ? BigInt(body.currentPrice) : undefined,
        sponsorBudgetLimit: body.sponsorBudgetLimit !== undefined ? BigInt(body.sponsorBudgetLimit) : undefined,
        openAt: body.openAt !== undefined ? openAt : undefined,
        closeAt: body.closeAt !== undefined ? closeAt : undefined,
        params: body.params !== undefined ? body.params : undefined,
      },
    });
    await this.systemLog.info('road', 'Pool updated', { operatorAdminId, poolId: updated.id });
    return updated;
  }

  async getAdminLiability() {
    const [pendingAgg, topHoldings, treasury] = await Promise.all([
      this.prisma.roadKeyHolding.aggregate({ _sum: { pendingReward: true } }),
      this.prisma.roadKeyHolding.findMany({
        where: { pendingReward: { gt: 0n } },
        include: { user: { select: { id: true, nickname: true, walletAddress: true } }, pool: { include: { team: true } } },
        orderBy: { pendingReward: 'desc' },
        take: 100,
      }),
      this.prisma.$transaction((tx) => this.treasury.getBalances(tx)),
    ]);

    const pending = pendingAgg._sum.pendingReward ?? 0n;
    const reserveCoverageRatio = pending > 0n ? Number(treasury.reserveBalance) / Number(pending) : 1;

    return {
      pendingRewardLiability: Number(pending) / 100,
      reserveBalance: Number(treasury.reserveBalance) / 100,
      reserveCoverageRatio: Number.isFinite(reserveCoverageRatio) ? reserveCoverageRatio : 0,
      topHoldings: topHoldings.map((h) => ({
        holdingId: h.id,
        userId: h.userId,
        nickname: h.user.nickname,
        walletAddress: h.user.walletAddress,
        team: h.pool.team.code,
        stage: h.pool.stage,
        pendingReward: Number(h.pendingReward) / 100,
        releasedReward: Number(h.releasedReward) / 100,
        keyAmount: Number(h.keyAmount),
        updatedAt: h.updatedAt,
      })),
      timestamp: new Date(),
    };
  }
}
