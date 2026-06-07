import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoadDividendService } from './road-dividend.service';
import { SystemLogService } from '../system-log/system-log.service';
import { PoolStatus, RoadStage, TeamStatus, RoadTreasuryBucket, RoadTreasuryEventType } from '@prisma/client';
import { RoadTreasuryService } from './road-treasury.service';

function stageRank(stage: RoadStage) {
  switch (stage) {
    case RoadStage.GROUP:
      return 0;
    case RoadStage.TOP32:
      return 1;
    case RoadStage.TOP16:
      return 2;
    case RoadStage.TOP8:
      return 3;
    case RoadStage.TOP4:
      return 4;
    case RoadStage.FINAL:
      return 5;
    case RoadStage.CHAMPION:
      return 6;
  }
}

function nextStage(stage: RoadStage): RoadStage | null {
  switch (stage) {
    case RoadStage.TOP32:
      return RoadStage.TOP16;
    case RoadStage.TOP16:
      return RoadStage.TOP8;
    case RoadStage.TOP8:
      return RoadStage.TOP4;
    case RoadStage.TOP4:
      return RoadStage.FINAL;
    case RoadStage.FINAL:
      return RoadStage.CHAMPION;
    default:
      return null;
  }
}

function defaultBasePrice(stage: RoadStage) {
  switch (stage) {
    case RoadStage.TOP32:
      return 500n;
    case RoadStage.TOP16:
      return 400n;
    case RoadStage.TOP8:
      return 280n;
    case RoadStage.TOP4:
      return 180n;
    case RoadStage.FINAL:
      return 120n;
    case RoadStage.CHAMPION:
      return 80n;
    default:
      return 100n;
  }
}

function isBotIdentity(user: { walletAddress: string; nickname: string | null }) {
  const wallet = (user.walletAddress || '').toLowerCase();
  const nickname = (user.nickname || '').toLowerCase();
  return wallet.startsWith('bot:') || wallet.startsWith('0xbot') || nickname.startsWith('bot_');
}

@Injectable()
export class RoadSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dividend: RoadDividendService,
    private readonly systemLog: SystemLogService,
    private readonly treasury: RoadTreasuryService,
  ) {}

  async closePool(operatorAdminId: string, poolId: string) {
    const updated = await this.prisma.roadPool.update({
      where: { id: poolId },
      data: { status: PoolStatus.CLOSED, closeAt: new Date() },
    });
    await this.systemLog.info('road', 'Pool closed', { operatorAdminId, poolId });
    return { success: true, pool: updated };
  }

  async previewAdvance(operatorAdminId: string, teamId: string, reachedStageRaw: string) {
    const reachedStage = String(reachedStageRaw || '').toUpperCase() as RoadStage;
    if (!Object.values(RoadStage).includes(reachedStage) || reachedStage === RoadStage.GROUP) {
      throw new BadRequestException('Invalid reachedStage');
    }

    const now = new Date();
    const preview = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team) throw new BadRequestException('Team not found');

      const pool = await tx.roadPool.findUnique({
        where: { teamId_stage: { teamId, stage: reachedStage } },
        include: { team: true },
      });
      if (!pool) throw new BadRequestException('Pool not found');

      const budget = pool.prizePool ?? 0n;
      const toHoldersTarget = (budget * 55n) / 100n;
      const toNext = (budget * 25n) / 100n;
      const toSuper = (budget * 10n) / 100n;
      const toReserveBase = (budget * 5n) / 100n;
      const toPlatform = budget - toHoldersTarget - toNext - toSuper - toReserveBase;

      const params = (pool.params || {}) as any;
      const roadConfig = await tx.roadConfig.findUnique({ where: { seasonCode: 'WC2026' } });
      const releaseDelayHours = roadConfig?.releaseDelayHours ?? 24;
      const next = nextStage(reachedStage);

      let nextPool: any = null;
      let willAutoCreateNext = false;
      if (next) {
        const existingNext = await tx.roadPool.findUnique({ where: { teamId_stage: { teamId, stage: next } } });
        if (existingNext) {
          nextPool = { id: existingNext.id, status: existingNext.status, openAt: existingNext.openAt, closeAt: existingNext.closeAt, stage: existingNext.stage };
        } else {
          willAutoCreateNext = true;
          const nextStageCloseHours = Number(params.nextStageCloseHours ?? 168);
          nextPool = {
            id: null,
            status: 'OPEN',
            stage: next,
            openAt: now,
            closeAt: new Date(now.getTime() + nextStageCloseHours * 3600000),
          };
        }
      }

      const holdings = await tx.roadKeyHolding.findMany({
        where: { poolId: pool.id, status: 'ACTIVE' },
        select: { userId: true, keyAmount: true, user: { select: { walletAddress: true, nickname: true } } },
      });
      const holdersTotal = holdings.filter((h) => h.keyAmount.gt(0)).length;
      const holdersEligible = holdings.filter((h) => h.keyAmount.gt(0) && !isBotIdentity(h.user)).length;

      return {
        alreadySettled: pool.status === PoolStatus.SETTLED || !!pool.settledAt,
        teamId,
        reachedStage,
        pool: { id: pool.id, stage: pool.stage, status: pool.status, prizePool: pool.prizePool, sponsorAmount: pool.sponsorAmount },
        holders: { total: holdersTotal, eligible: holdersEligible },
        distribution: {
          budget,
          toHoldersTarget,
          toNext,
          toSuper,
          toReserveBase,
          toPlatform,
          releaseDelayHours,
          nextPool,
          willAutoCreateNext,
        },
      };
    });

    await this.systemLog.info('road', 'Advance preview', { operatorAdminId, teamId, reachedStageRaw, preview });
    return { success: true, preview };
  }

  async previewEliminate(operatorAdminId: string, teamId: string, eliminatedAtStageRaw: string) {
    const eliminatedAtStage = String(eliminatedAtStageRaw || '').toUpperCase() as RoadStage;
    if (!Object.values(RoadStage).includes(eliminatedAtStage) || eliminatedAtStage === RoadStage.GROUP) {
      throw new BadRequestException('Invalid eliminatedAtStage');
    }

    const preview = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team) throw new BadRequestException('Team not found');

      const cutoff = stageRank(eliminatedAtStage);
      const futurePools = await tx.roadPool.findMany({
        where: {
          teamId,
          status: { notIn: [PoolStatus.CANCELLED, PoolStatus.SETTLED] },
          prizePool: { gt: 0n },
        },
        orderBy: { stage: 'asc' },
      });

      const impacted = futurePools.filter((p) => stageRank(p.stage) > cutoff);
      const totalFuture = impacted.reduce((acc, p) => acc + (p.prizePool ?? 0n), 0n);

      const toSuper = (totalFuture * 45n) / 100n;
      const toSurvivor = (totalFuture * 25n) / 100n;
      const toReserve = (totalFuture * 15n) / 100n;
      const toPlatform = (totalFuture * 10n) / 100n;
      const toActivity = totalFuture - toSuper - toSurvivor - toReserve - toPlatform;

      return {
        alreadyEliminated: team.status === TeamStatus.ELIMINATED,
        teamId,
        eliminatedAtStage,
        impactedPools: impacted.map((p) => ({ id: p.id, stage: p.stage, status: p.status, prizePool: p.prizePool })),
        distribution: { totalFuture, toSuper, toSurvivor, toReserve, toPlatform, toActivity },
      };
    });

    await this.systemLog.info('road', 'Eliminate preview', { operatorAdminId, teamId, eliminatedAtStageRaw, preview });
    return { success: true, preview };
  }

  async advanceTeam(operatorAdminId: string, teamId: string, reachedStageRaw: string) {
    const reachedStage = String(reachedStageRaw || '').toUpperCase() as RoadStage;
    if (!Object.values(RoadStage).includes(reachedStage)) {
      throw new BadRequestException('Invalid reachedStage');
    }
    if (reachedStage === RoadStage.GROUP) {
      throw new BadRequestException('Invalid reachedStage');
    }

    const now = new Date();
    const roadConfig = await this.prisma.roadConfig.findUnique({ where: { seasonCode: 'WC2026' } });
    const releaseDelayHours = roadConfig?.releaseDelayHours ?? 24;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team) throw new BadRequestException('Team not found');

      const pool = await tx.roadPool.findUnique({
        where: { teamId_stage: { teamId, stage: reachedStage } },
      });
      if (!pool) throw new BadRequestException('Pool not found');

      await tx.$queryRaw`SELECT id FROM road_pools WHERE id = ${pool.id} FOR UPDATE`;
      const lockedPool = await tx.roadPool.findUnique({
        where: { id: pool.id },
        include: { team: true },
      });
      if (!lockedPool) throw new BadRequestException('Pool not found');

      if (lockedPool.status === PoolStatus.SETTLED || lockedPool.settledAt) {
        return { alreadySettled: true, poolId: lockedPool.id };
      }

      const budget = lockedPool.prizePool ?? 0n;
      const toHoldersTarget = (budget * 55n) / 100n;
      const toNext = (budget * 25n) / 100n;
      const toSuper = (budget * 10n) / 100n;
      const toReserveBase = (budget * 5n) / 100n;
      const toPlatform = budget - toHoldersTarget - toNext - toSuper - toReserveBase;

      const params = (lockedPool.params || {}) as any;
      const beta = Number(params.beta ?? 0.08);
      const ageBoostCap = Number(params.ageBoostCap ?? 1.35);

      const rewardResult = await this.dividend.distributeStageReward(tx, {
        poolId: lockedPool.id,
        rewardBudget: toHoldersTarget,
        releaseDelayHours,
        beta,
        ageBoostCap,
        now,
      });

      const toHolders = rewardResult.distributed;
      const remainderToReserve = toHoldersTarget - toHolders;
      const toReserve = toReserveBase + (remainderToReserve > 0n ? remainderToReserve : 0n);

      let nextPoolId: string | null = null;
      const ns = nextStage(reachedStage);
      if (ns) {
        const existingNext = await tx.roadPool.findUnique({ where: { teamId_stage: { teamId, stage: ns } } });
        if (existingNext) {
          if (process.env.NODE_ENV === 'production' && !existingNext.closeAt) {
            throw new BadRequestException('Next stage pool closeAt required');
          }
          const nextUpdated = await tx.roadPool.update({
            where: { id: existingNext.id },
            data: {
              prizePool: { increment: toNext },
              status: PoolStatus.OPEN,
              openAt: existingNext.openAt ?? now,
            },
          });
          nextPoolId = nextUpdated.id;
        } else {
          const nextStageCloseHours = Number(params.nextStageCloseHours ?? 72);
          const nextCloseAt = new Date(now.getTime() + Math.max(1, nextStageCloseHours) * 3600000);
          if (process.env.NODE_ENV === 'production' && !nextCloseAt) {
            throw new BadRequestException('Next stage pool closeAt required');
          }
          const createdNext = await tx.roadPool.create({
            data: {
              teamId,
              stage: ns,
              status: PoolStatus.OPEN,
              basePrice: defaultBasePrice(ns),
              currentPrice: defaultBasePrice(ns),
              sponsorBudgetLimit: 50000n,
              openAt: now,
              closeAt: nextCloseAt,
              params: lockedPool.params ?? undefined,
            },
          });
          nextPoolId = createdNext.id;
          if (toNext > 0n) {
            await tx.roadPool.update({
              where: { id: createdNext.id },
              data: { prizePool: { increment: toNext } },
            });
          }
        }
      }

      if (toSuper > 0n) {
        await tx.superJackpot.upsert({
          where: { seasonCode: 'WC2026' },
          update: { amount: { increment: toSuper }, updatedAt: now },
          create: { seasonCode: 'WC2026', amount: toSuper, status: 'ACTIVE' },
        });
      }

      const updatedPool = await tx.roadPool.update({
        where: { id: lockedPool.id },
        data: {
          status: PoolStatus.SETTLED,
          closeAt: lockedPool.closeAt ?? now,
          settledAt: now,
          prizePool: 0n,
          superPoolContrib: { increment: toSuper },
          reserveContrib: { increment: toReserve },
        },
      });

      await this.treasury.record(tx, {
        eventType: RoadTreasuryEventType.STAGE_ADVANCE,
        eventId: lockedPool.id,
        entries: [
          { bucket: RoadTreasuryBucket.POOL_PRIZE, amount: -budget, poolId: lockedPool.id, meta: { teamId, stage: reachedStage } },
          { bucket: RoadTreasuryBucket.PENDING_REWARD, amount: toHolders, poolId: lockedPool.id, meta: { teamId, stage: reachedStage } },
          { bucket: RoadTreasuryBucket.POOL_PRIZE, amount: toNext, poolId: nextPoolId, meta: { teamId, stage: ns } },
          { bucket: RoadTreasuryBucket.SUPER_JACKPOT, amount: toSuper, poolId: lockedPool.id, meta: { teamId, stage: reachedStage } },
          { bucket: RoadTreasuryBucket.RESERVE, amount: toReserve, poolId: lockedPool.id, meta: { teamId, stage: reachedStage } },
          { bucket: RoadTreasuryBucket.PLATFORM_CARRY, amount: toPlatform, poolId: lockedPool.id, meta: { teamId, stage: reachedStage } },
        ],
      });

      await tx.roadKeyHolding.updateMany({
        where: { poolId: lockedPool.id, status: 'ACTIVE' },
        data: { status: 'WON' },
      });

      const teamUpdate: any = {
        currentStage: reachedStage,
        status: TeamStatus.ADVANCED,
      };
      if (reachedStage === RoadStage.CHAMPION) {
        teamUpdate.status = TeamStatus.CHAMPION;
      }
      await tx.team.update({ where: { id: teamId }, data: teamUpdate });

      return {
        alreadySettled: false,
        pool: updatedPool,
        stage: reachedStage,
        distribution: {
          budget,
          toHoldersTarget,
          toHolders,
          toNext,
          toSuper,
          toReserve,
          toPlatform,
          remainderToReserve,
          nextPoolId,
        },
        reward: rewardResult,
      };
    });

    await this.systemLog.info('road', 'Team advanced', {
      operatorAdminId,
      teamId,
      reachedStage: reachedStageRaw,
      result,
    });

    return { success: true, result };
  }

  async eliminateTeam(operatorAdminId: string, teamId: string, eliminatedAtStageRaw: string) {
    const eliminatedAtStage = String(eliminatedAtStageRaw || '').toUpperCase() as RoadStage;
    if (!Object.values(RoadStage).includes(eliminatedAtStage)) {
      throw new BadRequestException('Invalid eliminatedAtStage');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team) throw new BadRequestException('Team not found');
      if (team.status === TeamStatus.ELIMINATED) {
        return {
          alreadyEliminated: true,
          teamId,
          eliminatedAtStage,
          poolsCancelled: 0,
          totalFuture: 0n,
          toSuper: 0n,
          toSurvivor: 0n,
          toReserve: 0n,
          toPlatform: 0n,
          toActivity: 0n,
        };
      }

      const cutoff = stageRank(eliminatedAtStage);
      const pools = await tx.roadPool.findMany({
        where: {
          teamId,
          status: { notIn: [PoolStatus.CANCELLED, PoolStatus.SETTLED] },
        },
        orderBy: { stage: 'asc' },
      });

      const futurePools = pools
        .filter((p) => stageRank(p.stage) > cutoff)
        .filter((p) => (p.prizePool ?? 0n) > 0n);

      for (const p of futurePools) {
        await tx.$queryRaw`SELECT id FROM road_pools WHERE id = ${p.id} FOR UPDATE`;
      }

      const totalFuture = futurePools.reduce((sum, p) => sum + (p.prizePool ?? 0n), 0n);

      const toSuper = (totalFuture * 45n) / 100n;
      const toSurvivor = (totalFuture * 25n) / 100n;
      const toReserve = (totalFuture * 15n) / 100n;
      const toPlatform = (totalFuture * 10n) / 100n;
      const toActivity = totalFuture - toSuper - toSurvivor - toReserve - toPlatform;

      if (toSuper > 0n) {
        await tx.superJackpot.upsert({
          where: { seasonCode: 'WC2026' },
          update: { amount: { increment: toSuper }, updatedAt: now },
          create: { seasonCode: 'WC2026', amount: toSuper, status: 'ACTIVE' },
        });
      }

      for (const p of futurePools) {
        const budget = p.prizePool ?? 0n;
        if (budget <= 0n) continue;

        await tx.roadPool.update({
          where: { id: p.id },
          data: {
            status: PoolStatus.CANCELLED,
            closeAt: p.closeAt ?? now,
            settledAt: p.settledAt ?? now,
            prizePool: 0n,
          },
        });

        await this.treasury.record(tx, {
          eventType: RoadTreasuryEventType.TEAM_ELIMINATION,
          eventId: `${teamId}:${eliminatedAtStage}`,
          entries: [{ bucket: RoadTreasuryBucket.POOL_PRIZE, amount: -budget, poolId: p.id, meta: { teamId, stage: p.stage } }],
        });

        await tx.roadKeyHolding.updateMany({
          where: { poolId: p.id, status: 'ACTIVE' },
          data: { status: 'LOST' },
        });
      }

      if (totalFuture > 0n) {
        await this.treasury.record(tx, {
          eventType: RoadTreasuryEventType.TEAM_ELIMINATION,
          eventId: `${teamId}:${eliminatedAtStage}`,
          entries: [
            { bucket: RoadTreasuryBucket.SUPER_JACKPOT, amount: toSuper, meta: { teamId, eliminatedAtStage } },
            { bucket: RoadTreasuryBucket.SURVIVOR_PUBLIC_POOL, amount: toSurvivor, meta: { teamId, eliminatedAtStage } },
            { bucket: RoadTreasuryBucket.RESERVE, amount: toReserve, meta: { teamId, eliminatedAtStage } },
            { bucket: RoadTreasuryBucket.PLATFORM_CARRY, amount: toPlatform, meta: { teamId, eliminatedAtStage } },
            { bucket: RoadTreasuryBucket.ACTIVITY_BUDGET, amount: toActivity, meta: { teamId, eliminatedAtStage } },
          ],
        });
      }

      await tx.team.update({
        where: { id: teamId },
        data: { status: TeamStatus.ELIMINATED, currentStage: eliminatedAtStage },
      });

      return {
        teamId,
        eliminatedAtStage,
        poolsCancelled: futurePools.length,
        totalFuture,
        toSuper,
        toSurvivor,
        toReserve,
        toPlatform,
        toActivity,
      };
    });

    await this.systemLog.warn('road', 'Team eliminated', { operatorAdminId, result });
    return { success: true, result };
  }
}
