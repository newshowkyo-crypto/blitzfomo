// apps/api/src/settlement/settlement.worker.ts
// Blitz Finale 结算 Worker（使用 Redlock 防止重复发奖）
//
// 核心职责：
// 1. 定时扫描已到期的 OPEN round
// 2. 使用 Redlock 获取分布式锁
// 3. 在事务内完成：
//    - 确定赢家（lastBuyer）
//    - 计算 70% / 30%
//    - 通过 LedgerService 发放奖金 + 平台抽成
//    - 关闭当前 round
//    - 创建新 round（注入初始奖池）
//    - 广播 round:settled 事件
//
// 铁律：
// - 必须用 Redlock，严禁仅靠数据库事务或 BullMQ 去重
// - 机器人中奖（is_bot_winner）不真实发放奖金，奖池滚入下一轮

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RedisService } from '../redis/redis.service';
import { GameGateway } from '../socket/game.gateway';
import { SystemLogService } from '../system-log/system-log.service';
import Redlock from 'redlock';
import { RoundStatus, LedgerType } from '@prisma/client';

@Injectable()
export class SettlementWorker {
  private readonly logger = new Logger(SettlementWorker.name);
  private redlock: Redlock;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly redisService: RedisService,
    private readonly gameGateway: GameGateway,
    private readonly systemLog: SystemLogService,
  ) {
    // 初始化 Redlock（建议至少 3 个 Redis 实例生产环境，这里简化为单实例演示）
    this.redlock = new Redlock(
      [this.redisService.getClient()],
      {
        driftFactor: 0.01,
        retryCount: 3,
        retryDelay: 200,
        retryJitter: 100,
      },
    );
  }

  /**
   * 每 5 秒扫描一次到期轮次
   * 生产环境建议用 BullMQ + 精确调度，或直接监听 Redis key 过期事件
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    const now = Date.now();

    // 找出所有已到期但仍 OPEN 的轮次
    const expiredRounds = await this.prisma.round.findMany({
      where: {
        status: RoundStatus.OPEN,
        deadlineAt: { lte: new Date(now) },
      },
      take: 5, // 一次最多处理 5 个，防止长时间阻塞
    });

    for (const round of expiredRounds) {
      await this.settleRound(round.id);
    }
  }

  /**
   * 单轮结算（带 Redlock）
   */
  private async settleRound(roundId: string) {
    const lockKey = `settlement:lock:round:${roundId}`;
    let lock: any = null;

    try {
      // 关键：获取分布式锁，持有 30 秒
      lock = await this.redlock.acquire([lockKey], 30000);

      this.logger.log(`[SETTLEMENT] Acquired lock for round ${roundId}`);

      // 再次确认 round 状态（防止竞态）
      const round = await this.prisma.round.findUnique({ where: { id: roundId } });
      if (!round || round.status !== RoundStatus.OPEN) {
        this.logger.warn(`[SETTLEMENT] Round ${roundId} already settled or not open`);
        return;
      }

      // 预加载游戏配置（事务外读取，事务内不再重复查询）
      const gameConfig = await this.prisma.gameConfig.findUnique({ where: { id: 1 } });

      // ========== 核心结算事务 ==========
      await this.prisma.$transaction(async (tx) => {
        // 1. 确定赢家 & 判断是否为机器人
        const winnerUserId = round.lastBuyerUserId;

        let lastPurchase: { isBot: boolean } | null = null;
        if (winnerUserId) {
          lastPurchase = await tx.purchase.findFirst({
            where: { roundId, userId: winnerUserId },
            orderBy: { createdAt: 'desc' },
          });
        }

        const isBotWinner = winnerUserId ? (lastPurchase?.isBot ?? false) : true;
        const isRealWinner = winnerUserId && !isBotWinner;

        const prizePool = round.prizePool;
        const winnerPercent = gameConfig?.winnerPercent ?? 70;
        const platformPercent = gameConfig?.platformPercent ?? 30;
        const winnerAmount = (prizePool * BigInt(winnerPercent)) / 100n;
        const platformFee = prizePool - winnerAmount;

        // 2. 真实赢家且非机器人 → 发放奖金（严格遵守 TDD：机器人中奖不真实发奖）
        if (isRealWinner) {
          await this.ledgerService.applyLedgerTx(tx, {
            userId: winnerUserId!,
            type: LedgerType.WIN,
            amount: winnerAmount,
            description: `Winner prize for round #${round.roundNumber}`,
            roundId,
            meta: { percent: winnerPercent, prizePool: prizePool.toString() },
          });

          await tx.user.update({
            where: { id: winnerUserId },
            data: { totalWon: { increment: winnerAmount } },
          });
        } else {
          this.logger.log(`[SETTLEMENT] Round ${roundId} won by bot or no buyer. Prize rolls over to next round.`);
        }

        // 3. 平台抽成写入 ledger（资金闭环铁律：所有资金流动必须写 ledger）
        if (platformFee > 0n) {
          const platformAccount = await tx.user.findFirst({
            where: { walletAddress: 'system:platform' },
          });

          let platformUserId: string;
          if (!platformAccount) {
            const created = await tx.user.create({
              data: {
                walletAddress: 'system:platform',
                nickname: 'Platform Treasury',
                balance: 0n,
              },
            });
            platformUserId = created.id;
          } else {
            platformUserId = platformAccount.id;
          }

          await this.ledgerService.applyLedgerTx(tx, {
            userId: platformUserId,
            type: LedgerType.PLATFORM_FEE,
            amount: platformFee,
            description: `Platform fee ${platformPercent}% for round #${round.roundNumber}`,
            roundId,
            meta: { percent: platformPercent, prizePool: prizePool.toString() },
          });

          this.logger.log(`[SETTLEMENT] Platform fee collected: ${platformFee} for round ${roundId}`);
        }

        // 4. 关闭当前 round
        await tx.round.update({
          where: { id: roundId },
          data: {
            status: RoundStatus.SETTLED,
            settledAt: new Date(),
            winnerUserId: winnerUserId || null,
            winnerNickname: round.lastBuyerNickname,
            winnerAmount: isRealWinner ? winnerAmount : 0n,
            platformFee,
            isBotWinner,
          },
        });

        // 5. 创建新轮次
        //    机器人中奖时：奖池滚入下轮（winnerAmount 不发放，加入新轮奖池）
        //    真实赢家时：仅注入初始奖池
        const initialPool = gameConfig?.initialPrizePool ?? 100000n;
        const rolloverAmount = isRealWinner ? 0n : winnerAmount;
        const newPrizePool = initialPool + rolloverAmount;

        const newRoundNumber = round.roundNumber + 1;
        const newDeadline = new Date(Date.now() + (gameConfig?.countdownSeconds ?? 60) * 1000);

        const newRound = await tx.round.create({
          data: {
            roundNumber: newRoundNumber,
            prizePool: newPrizePool,
            initialPool,
            status: RoundStatus.OPEN,
            startedAt: new Date(),
            deadlineAt: newDeadline,
          },
        });

        if (rolloverAmount > 0n) {
          this.logger.log(`[SETTLEMENT] Rollover ${rolloverAmount} from bot-won round to new round #${newRoundNumber}`);
        }
        this.logger.log(`[SETTLEMENT] New round #${newRoundNumber} created with prize pool ${newPrizePool} (initial=${initialPool}, rollover=${rolloverAmount})`);

        // 6. 清理旧轮 Redis 状态 & 初始化新轮 Redis 状态
        const redis = this.redisService.getClient();
        await redis.del(`round:state:${roundId}`);
        await redis.hset(`round:state:${newRound.id}`, {
          prizePool: newPrizePool.toString(),
          deadline: newDeadline.getTime().toString(),
          lastBuyer: '',
          lastBuyerNickname: '',
          status: 'OPEN',
          updatedAt: Date.now().toString(),
        });

        // 7. 广播结算事件
        this.gameGateway.broadcastRoundSettled({
          roundId,
          winner: {
            userId: winnerUserId,
            nickname: round.lastBuyerNickname,
            amount: isRealWinner ? Number(winnerAmount) / 100 : 0,
            isBot: isBotWinner,
          },
          newRound: {
            id: newRound.id,
            roundNumber: newRound.roundNumber,
            prizePool: Number(newPrizePool) / 100,
          },
        });
      });

    } catch (err: any) {
      if (err.name === 'LockError' || err.message?.includes('lock')) {
        this.logger.debug(`[SETTLEMENT] Could not acquire lock for round ${roundId} (another instance is handling)`);
      } else {
        this.logger.error(`[SETTLEMENT] Failed to settle round ${roundId}`, err.stack);
        // 结算异常落库，便于后台「系统日志」页排查与人工介入
        await this.systemLog.error('settlement', `Failed to settle round ${roundId}`, {
          roundId,
          error: err?.message,
          stack: err?.stack,
        });
      }
    } finally {
      if (lock) {
        try {
          await lock.release();
        } catch (releaseErr) {
          this.logger.warn(`[SETTLEMENT] Failed to release lock for round ${roundId}`);
        }
      }
    }
  }
}
