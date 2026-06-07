// apps/api/src/queue/queue.module.ts
// BullMQ 队列模块（用于机器人 + 未来其他异步任务）

import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

const redisUrl = new URL(process.env.REDIS_URL || 'redis://:blitz_redis_2026@localhost:6379');

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        password: redisUrl.password || undefined,
      },
    }),
    BullModule.registerQueue({
      name: 'bot-purchase',
    }),
    BullModule.registerQueue({
      name: 'settlement',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
