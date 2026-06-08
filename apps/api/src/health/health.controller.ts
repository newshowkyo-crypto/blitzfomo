// apps/api/src/health/health.controller.ts
// 健康检查端点（P1 要求）

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const dbOk = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redisOk = await this.redis.getClient().ping().then(() => true).catch(() => false);

    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date(),
    };
  }
}