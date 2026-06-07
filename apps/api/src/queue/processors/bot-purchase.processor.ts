// apps/api/src/queue/processors/bot-purchase.processor.ts
// BullMQ 机器人购买处理器（P7）

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PurchaseService } from '../../game/purchase.service';

@Processor('bot-purchase')
@Injectable()
export class BotPurchaseProcessor extends WorkerHost {
  private readonly logger = new Logger(BotPurchaseProcessor.name);

  constructor(
    private readonly purchaseService: PurchaseService,
  ) {
    super();
  }

  async process(job: Job) {
    const { userId, amount } = job.data;

    this.logger.log(`Processing bot purchase for user ${userId}, amount ${amount}`);

    try {
      // 机器人购买：传入 isBot=true，标记 purchases.is_bot = true
      // 结算时机器人中奖不会真实发奖（已在 SettlementWorker 处理）
      await this.purchaseService.purchase(userId, BigInt(amount), undefined, true);

      this.logger.log(`Bot purchase completed for job ${job.id}`);
    } catch (error) {
      this.logger.error(`Bot purchase failed for job ${job.id}`, error);
      throw error;
    }
  }
}
