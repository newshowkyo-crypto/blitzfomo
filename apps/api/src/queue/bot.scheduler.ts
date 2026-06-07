// apps/api/src/queue/bot.scheduler.ts
// 机器人定时调度器（P7）

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BotScheduler {
  private readonly logger = new Logger(BotScheduler.name);

  constructor(
    @InjectQueue('bot-purchase') private readonly botQueue: Queue,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleBotPurchases() {
    const gameConfig = await this.configService.getGameConfig();

    if (!gameConfig?.botEnabled) return;
    const intervalMs = Math.max(Number(gameConfig.botPurchaseIntervalMs || 30000), 10000);
    const now = Date.now();
    const lastRunKey = 'bot:auto:last-run';
    const lastRun = Number(await this.redis.getClient().get(lastRunKey) || 0);
    if (now - lastRun < intervalMs) return;

    const botUsers = await this.prisma.user.findMany({
      where: { nickname: { startsWith: 'Bot_' } },
      take: 5,
    });

    if (botUsers.length === 0) {
      this.logger.warn('No bot users. Please run seed or create via admin.');
      return;
    }

    const randomUser = botUsers[Math.floor(Math.random() * botUsers.length)];
    const min = Number(gameConfig.botMinAmount || 1000);
    const max = Number(gameConfig.botMaxAmount || 10000);
    const amount = Math.floor(Math.random() * (Math.max(max, min) - min + 1) + min);

    await this.botQueue.add('buy', {
      userId: randomUser.id,
      amount,
    });
    await this.redis.getClient().set(lastRunKey, String(now), 'PX', intervalMs * 2);

    this.logger.log(`[BOT] Scheduled purchase for ${randomUser.nickname} amount=${amount}`);
  }
}
