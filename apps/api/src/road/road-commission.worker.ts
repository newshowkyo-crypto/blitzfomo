import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RoadCommissionStatus } from '@prisma/client';

function isBotIdentity(user: { walletAddress: string; nickname: string | null }) {
  const wallet = (user.walletAddress || '').toLowerCase();
  const nickname = (user.nickname || '').toLowerCase();
  return wallet.startsWith('bot:') || wallet.startsWith('0xbot') || nickname.startsWith('bot_');
}

@Injectable()
export class RoadCommissionReleaseWorker {
  private readonly logger = new Logger(RoadCommissionReleaseWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const now = new Date();
    const due = await this.prisma.roadReferralCommission.findMany({
      where: { status: RoadCommissionStatus.PENDING, releaseAt: { lte: now } },
      include: { inviter: { select: { walletAddress: true, nickname: true } } },
      orderBy: { releaseAt: 'asc' },
      take: 50,
    });

    if (due.length === 0) return;

    for (const c of due) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.roadReferralCommission.updateMany({
          where: { id: c.id, status: RoadCommissionStatus.PENDING },
          data: { status: RoadCommissionStatus.RELEASED },
        });
        if (updated.count !== 1) return;

        if (isBotIdentity(c.inviter)) {
          await tx.roadReferralCommission.update({ where: { id: c.id }, data: { status: RoadCommissionStatus.CANCELLED } });
          return;
        }

        await this.ledger.applyLedgerTx(tx, {
          userId: c.inviterId,
          type: 'WIN',
          amount: c.commissionAmount,
          description: 'Road referral commission released',
          meta: {
            roadCommissionId: c.id,
            purchaseId: c.purchaseId,
            referredUserId: c.referredUserId,
            amount: c.commissionAmount.toString(),
          },
        });
      });
    }

    this.logger.log(`[ROAD] Released ${due.length} commissions`);
  }
}

