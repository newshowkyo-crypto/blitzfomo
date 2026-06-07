// apps/api/src/config/config.module.ts
// 游戏配置模块（TDD 强烈要求：后台修改后即时刷新 Redis 缓存）

import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}