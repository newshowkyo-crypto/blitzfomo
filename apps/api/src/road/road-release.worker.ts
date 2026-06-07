import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RewardStatus, RoadTreasuryBucket, RoadTreasuryEventType } from '@prisma/client';
import { RoadTreasuryService } from './road-treasury.service';

function isBotIdentity(user: { walletAddress: string; nickname: string | null }) {
  const wallet = (user.walletAddress || '').toLowerCase();
  const nickname = (user.nickname || '').toLowerCase();
  return wallet.startsWith('bot:') || wallet.startsWith('0xbot') || nickname.startsWith('bot_');
}

@Injectable()
export class RoadRewardReleaseWorker {
  private readonly logger = new Logger(RoadRewardReleaseWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly treasury: RoadTreasuryService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const now = new Date();

    const due = await this.prisma.roadDividend.findMany({
      where: { status: RewardStatus.PENDING_RELEASE, releaseAt: { lte: now } },
      include: { user: { select: { walletAddress: true, nickname: true } } },
      orderBy: { releaseAt: 'asc' },
      take: 50,
    });

    if (due.length === 0) return;

    for (const d of due) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.roadDividend.updateMany({
          where: { id: d.id, status: RewardStatus.PENDING_RELEASE },
          data: { status: RewardStatus.RELEASED },
        });
        if (updated.count !== 1) return;

        if (isBotIdentity(d.user)) {
          await tx.roadDividend.update({ where: { id: d.id }, data: { status: RewardStatus.CANCELLED } });
          await tx.roadKeyHolding.updateMany({
            where: { userId: d.userId, poolId: d.poolId },
            data: {
              pendingReward: { decrement: d.amount },
            },
          });
          await this.treasury.record(tx, {
            eventType: RoadTreasuryEventType.REWARD_RELEASE,
            eventId: d.id,
            entries: [
              { bucket: RoadTreasuryBucket.PENDING_REWARD, amount: -d.amount, poolId: d.poolId, dividendId: d.id, meta: { userId: d.userId } },
              { bucket: RoadTreasuryBucket.RESERVE, amount: d.amount, poolId: d.poolId, dividendId: d.id, meta: { userId: d.userId, reason: 'bot_cancelled' } },
            ],
          });
          return;
        }

        await tx.roadKeyHolding.updateMany({
          where: { userId: d.userId, poolId: d.poolId },
          data: {
            pendingReward: { decrement: d.amount },
            releasedReward: { increment: d.amount },
          },
        });

        await this.treasury.record(tx, {
          eventType: RoadTreasuryEventType.REWARD_RELEASE,
          eventId: d.id,
          entries: [
            { bucket: RoadTreasuryBucket.PENDING_REWARD, amount: -d.amount, poolId: d.poolId, dividendId: d.id, meta: { userId: d.userId } },
            { bucket: RoadTreasuryBucket.USER_RELEASED, amount: d.amount, poolId: d.poolId, dividendId: d.id, meta: { userId: d.userId } },
          ],
        });

        await this.ledger.applyLedgerTx(tx, {
          userId: d.userId,
          type: 'WIN',
          amount: d.amount,
          description: 'Road reward released',
          meta: {
            roadDividendId: d.id,
            poolId: d.poolId,
            amount: d.amount.toString(),
          },
        });

        await tx.user.update({
          where: { id: d.userId },
          data: { totalWon: { increment: d.amount } },
        });
      });
    }

    this.logger.log(`[ROAD] Released ${due.length} dividends`);
  }
}
