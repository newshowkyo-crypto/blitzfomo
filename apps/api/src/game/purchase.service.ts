import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '../config/config.service';
import { GameGateway } from '../socket/game.gateway';
import { RiskService } from '../risk/risk.service';
import { LedgerType } from '@prisma/client';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly gameGateway: GameGateway,
    private readonly riskService: RiskService,
  ) {}

  private async getPlayableRound() {
    const gameConfig = await this.config.getGameConfig();
    const countdownSeconds = gameConfig?.countdownSeconds ?? 60;
    const now = Date.now();
    const freshDeadline = new Date(now + countdownSeconds * 1000);

    let round = await this.prisma.round.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

    if (!round) {
      const redis = this.redis.getClient();
      const lockKey = 'round:create:lock';
      const acquired = await redis.set(lockKey, '1', 'EX', 5, 'NX');
      if (acquired) {
        try {
          round = await this.prisma.round.findFirst({ where: { status: 'OPEN' }, orderBy: { startedAt: 'desc' } });
          if (!round) {
            const latest = await this.prisma.round.findFirst({ orderBy: { roundNumber: 'desc' } });
            round = await this.prisma.round.create({
              data: {
                roundNumber: (latest?.roundNumber ?? 0) + 1,
                prizePool: gameConfig?.initialPrizePool ?? 100000n,
                initialPool: gameConfig?.initialPrizePool ?? 100000n,
                status: 'OPEN',
                startedAt: new Date(now),
                deadlineAt: freshDeadline,
              },
            });
          }
        } finally {
          await redis.del(lockKey).catch(() => {});
        }
      } else {
        await new Promise(r => setTimeout(r, 200));
        round = await this.prisma.round.findFirst({ where: { status: 'OPEN' }, orderBy: { startedAt: 'desc' } });
        if (!round) throw new BadRequestException('Game round not available, please retry');
      }
    }

    const redis = this.redis.getClient();
    const key = `round:state:${round.id}`;
    const redisState = await redis.hgetall(key);
    const redisDeadline = Number(redisState.deadline || 0);
    const dbExpired = round.deadlineAt.getTime() <= now;
    const missingRedisState = !redisState.prizePool || !redisState.deadline || !redisState.status;
    const redisExpiredButDbOpen = !dbExpired && redisDeadline <= now;

    if (missingRedisState || redisExpiredButDbOpen) {
      await redis.hset(key, {
        prizePool: round.prizePool.toString(),
        deadline: round.deadlineAt.getTime().toString(),
        lastBuyer: round.lastBuyerUserId || '',
        lastBuyerNickname: round.lastBuyerNickname || '',
        status: 'OPEN',
        updatedAt: now.toString(),
      });
    }

    return { round, gameConfig };
  }

  async purchase(userId: string, amount: bigint, idempotencyKey?: string, isBot: boolean = false) {
    if (idempotencyKey) {
      const existingPurchase = await this.prisma.purchase.findUnique({
        where: { idempotencyKey },
        select: { userId: true },
      });

      if (existingPurchase) {
        if (existingPurchase.userId !== userId) {
          throw new BadRequestException('Invalid idempotency key');
        }

        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        if (!user) throw new BadRequestException('User not found');

        return {
          success: true,
          balance: Number(user.balance) / 100,
          duplicate: true,
        };
      }
    }

    const minBuy = await this.config.getMinBuyAmount();
    if (amount < minBuy) {
      throw new BadRequestException({
        code: 40003,
        message: `Purchase amount cannot be lower than ${Number(minBuy) / 100} BF`,
      });
    }

    const { round, gameConfig } = await this.getPlayableRound();
    const now = Date.now();
    if (round.deadlineAt.getTime() <= now) {
      throw new BadRequestException({ code: 40002, message: 'Round already ended' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.isFrozen) throw new BadRequestException('User is frozen');

    if (isBot) {
      // 机器人购买：更新奖池（机器人购买同样贡献奖池），但不扣余额
      const countdownSeconds = gameConfig?.countdownSeconds ?? 60;
      const newDeadline = new Date(now + countdownSeconds * 1000);

      const purchase = await this.prisma.purchase.create({
        data: { roundId: round.id, userId, amount, isBot: true, idempotencyKey },
      });

      // 更新数据库奖池 + 倒计时 + lastBuyer
      const updatedRound = await this.prisma.round.update({
        where: { id: round.id },
        data: {
          prizePool: { increment: amount },
          deadlineAt: newDeadline,
          lastBuyerUserId: userId,
          lastBuyerNickname: user.nickname || 'Bot',
        },
      });

      // 同步更新 Redis 状态
      const redis = this.redis.getClient();
      const roundKey = `round:state:${round.id}`;
      await redis.hset(roundKey, {
        prizePool: updatedRound.prizePool.toString(),
        deadline: newDeadline.getTime().toString(),
        lastBuyer: userId,
        lastBuyerNickname: user.nickname || 'Bot',
        status: 'OPEN',
        updatedAt: now.toString(),
      });

      const purchaseLogKey = `round:purchases:${round.id}`;
      await redis.lpush(purchaseLogKey, JSON.stringify({
        userId,
        nickname: user.nickname || 'Bot',
        amount: amount.toString(),
        ts: now,
        isBot: true,
      }));
      await redis.ltrim(purchaseLogKey, 0, 49);

      this.gameGateway.broadcastPurchase({
        userId,
        nickname: user.nickname,
        amount: Number(amount) / 100,
        roundId: round.id,
        isBot: true,
      });

      return {
        success: true,
        balance: Number(user.balance) / 100,
        bot: true,
        purchaseId: purchase.id,
      };
    }

    // 风控检查应在余额检查之前，避免攻击者通过大量请求消耗数据库资源
    const riskCheck = await this.riskService.checkPurchaseRisk(userId, amount);
    if (!riskCheck.allowed) {
      throw new BadRequestException({ code: 40004, message: riskCheck.reason });
    }

    if (user.balance < amount) {
      throw new BadRequestException({ code: 40005, message: 'Insufficient balance' });
    }

    const countdownSeconds = gameConfig?.countdownSeconds ?? 60;
    const newDeadline = new Date(now + countdownSeconds * 1000);

    let txResult: { balanceAfter: bigint; updatedRound: { prizePool: bigint } };
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
          data: { roundId: round.id, userId, amount, isBot, idempotencyKey },
        });

        const ledgerResult = await this.ledger.applyLedgerTx(tx, {
          userId,
          type: LedgerType.PURCHASE,
          amount: -amount,
          description: `Purchase in round #${round.roundNumber}`,
          roundId: round.id,
          purchaseId: purchase.id,
        });

        await tx.user.update({
          where: { id: userId },
          data: { totalPurchased: { increment: amount } },
        });

        const updatedRound = await tx.round.update({
          where: { id: round.id },
          data: {
            prizePool: { increment: amount },
            deadlineAt: newDeadline,
            lastBuyerUserId: userId,
            lastBuyerNickname: user.nickname || 'Anonymous',
          },
        });

        return { balanceAfter: ledgerResult.balanceAfter, updatedRound };
      });
    } catch (error: any) {
      if (idempotencyKey && error?.code === 'P2002') {
        const latestUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        if (!latestUser) throw new BadRequestException('User not found');
        return {
          success: true,
          balance: Number(latestUser.balance) / 100,
          duplicate: true,
        };
      }
      throw error;
    }

    const redis = this.redis.getClient();
    const roundKey = `round:state:${round.id}`;
    await redis.hset(roundKey, {
      prizePool: txResult.updatedRound.prizePool.toString(),
      deadline: newDeadline.getTime().toString(),
      lastBuyer: userId,
      lastBuyerNickname: user.nickname || 'Anonymous',
      status: 'OPEN',
      updatedAt: now.toString(),
    });

    const purchaseLogKey = `round:purchases:${round.id}`;
    await redis.lpush(purchaseLogKey, JSON.stringify({
      userId,
      nickname: user.nickname || 'Anonymous',
      amount: amount.toString(),
      ts: now,
    }));
    await redis.ltrim(purchaseLogKey, 0, 49);

    this.gameGateway.broadcastPurchase({
      userId,
      nickname: user.nickname,
      amount: Number(amount) / 100,
      roundId: round.id,
    });

    return {
      success: true,
      balance: Number(txResult.balanceAfter) / 100,
    };
  }
}
