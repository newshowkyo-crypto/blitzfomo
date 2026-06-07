import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '../config/config.service';
import { GameStateResponse } from '@blitz/shared/dto/game.dto';

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private async ensurePlayableRound() {
    const gameConfig = await this.config.getGameConfig();
    const countdownSeconds = gameConfig?.countdownSeconds ?? 60;
    const now = Date.now();
    const freshDeadline = new Date(now + countdownSeconds * 1000);

    let round = await this.prisma.round.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

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

    const redis = this.redis.getClient();
    const key = `round:state:${round.id}`;
    const redisState = await redis.hgetall(key);
    const redisDeadline = Number(redisState.deadline || 0);
    const missingRedisState = !redisState.prizePool || !redisState.deadline || !redisState.status;
    const dbExpired = round.deadlineAt.getTime() <= now;
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

  async getCurrentState(): Promise<GameStateResponse> {
    const { round, gameConfig } = await this.ensurePlayableRound();
    const [redisState, activeUsers, totalWithdrawn] = await Promise.all([
      this.redis.getClient().hgetall(`round:state:${round.id}`),
      this.prisma.user.count({
        where: { walletAddress: { not: { startsWith: 'bot:' } } },
      }),
      this.prisma.withdrawal.aggregate({
        where: { status: 'PAID' },
        _sum: { amountUsdt: true },
      }),
    ]);

    const prizePool = redisState.prizePool
      ? Number(redisState.prizePool) / 100
      : Number(round.prizePool) / 100;

    const deadline = redisState.deadline
      ? Math.max(0, Math.floor((Number(redisState.deadline) - Date.now()) / 1000))
      : Math.max(0, Math.floor((round.deadlineAt.getTime() - Date.now()) / 1000));

    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      prizePool,
      countdown: deadline,
      lastBuyer: redisState.lastBuyerNickname || round.lastBuyerNickname || null,
      minBuy: Number(gameConfig?.minBuyAmount ?? 100n) / 100,
      winnerPercent: gameConfig?.winnerPercent ?? 70,
      platformPercent: gameConfig?.platformPercent ?? 30,
      gameActive: deadline > 0,
      activeFans: activeUsers,
      totalWithdrawn: Number(totalWithdrawn._sum.amountUsdt ?? 0n) / 100,
      tournamentMapUrl: gameConfig?.tournamentMapUrl ?? null,
    };
  }

  async getRecentPurchases(limit = 20) {
    return this.prisma.purchase.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { nickname: true } },
      },
    });
  }

  async getWinnerWall(limit = 30) {
    return this.prisma.round.findMany({
      where: {
        status: 'SETTLED',
        winnerUserId: { not: null },
      },
      take: limit,
      orderBy: { settledAt: 'desc' },
      select: {
        roundNumber: true,
        winnerNickname: true,
        winnerAmount: true,
        settledAt: true,
      },
    });
  }
}
