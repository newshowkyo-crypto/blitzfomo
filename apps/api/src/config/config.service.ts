// apps/api/src/config/config.service.ts
// 核心配置服务
// 所有产品参数必须从这里读取，严禁硬编码（严格遵守 TDD + CODEX）

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameConfig, RiskConfig, RoadConfig } from '@prisma/client';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private readonly GAME_CONFIG_KEY = 'game:config';
  private readonly RISK_CONFIG_KEY = 'risk:config';
  private readonly ROAD_CONFIG_PREFIX = 'road:config:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.refreshAllConfigs();
    this.logger.log('ConfigService initialized and loaded into Redis');
  }

  /**
   * 从数据库加载配置并写入 Redis（后台修改后必须调用此方法）
   */
  async refreshAllConfigs() {
    const [gameConfig, riskConfig, roadConfig] = await Promise.all([
      this.prisma.gameConfig.findUnique({ where: { id: 1 } }),
      this.prisma.riskConfig.findUnique({ where: { id: 1 } }),
      this.prisma.roadConfig.findUnique({ where: { seasonCode: 'WC2026' } }),
    ]);

    if (gameConfig) {
      await this.redis.getClient().hset(this.GAME_CONFIG_KEY, this.toHash(gameConfig));
      this.logger.log('GameConfig refreshed to Redis');
    }
    if (riskConfig) {
      await this.redis.getClient().hset(this.RISK_CONFIG_KEY, this.toHash(riskConfig));
      this.logger.log('RiskConfig refreshed to Redis');
    }
    if (roadConfig) {
      await this.redis.getClient().hset(this.ROAD_CONFIG_PREFIX + roadConfig.seasonCode, this.toHash(roadConfig));
      this.logger.log('RoadConfig refreshed to Redis');
    }
  }

  async getGameConfig(): Promise<GameConfig | null> {
    const data = await this.redis.getClient().hgetall(this.GAME_CONFIG_KEY);
    if (!Object.keys(data).length) {
      // Redis 没有则回源 DB
      const db = await this.prisma.gameConfig.findUnique({ where: { id: 1 } });
      if (db) await this.redis.getClient().hset(this.GAME_CONFIG_KEY, this.toHash(db));
      return db;
    }
    return this.fromHash(data) as any;
  }

  async getRiskConfig(): Promise<RiskConfig | null> {
    const data = await this.redis.getClient().hgetall(this.RISK_CONFIG_KEY);
    if (!Object.keys(data).length) {
      const db = await this.prisma.riskConfig.findUnique({ where: { id: 1 } });
      if (db) await this.redis.getClient().hset(this.RISK_CONFIG_KEY, this.toHash(db));
      return db;
    }
    return this.fromHash(data) as any;
  }

  async getRoadConfig(seasonCode: string = 'WC2026'): Promise<RoadConfig | null> {
    const key = this.ROAD_CONFIG_PREFIX + seasonCode;
    const data = await this.redis.getClient().hgetall(key);
    if (!Object.keys(data).length) {
      const db = await this.prisma.roadConfig.findUnique({ where: { seasonCode } });
      if (db) await this.redis.getClient().hset(key, this.toHash(db));
      return db;
    }
    return this.fromHash(data) as any;
  }

  // 辅助：Prisma 对象 <-> Redis Hash
  private toHash(obj: any): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined) continue;
      result[k] = typeof v === 'bigint' ? v.toString() : String(v);
    }
    return result;
  }

  private fromHash(hash: Record<string, string>): any {
    const result: any = {};
    const bigintFields = new Set([
      'initialPrizePool',
      'minBuyAmount',
      'botMinAmount',
      'botMaxAmount',
      'withdrawMinAmount',
      'withdrawMaxAmountDaily',
      'purchaseMaxAmountPerTx',
      'largeAmountThreshold',
      'sponsorGlobalBudget',
      'totalBudget',
      'usedBudget',
      'remainingBudget',
    ]);
    // 字段应该保持为字符串（如 id, seasonCode, activePaymentGateway 等）
    const stringFields = new Set([
      'id',
      'seasonCode',
      'activePaymentGateway',
      'tournamentMapUrl',
    ]);
    // 字段应为整数（非 bigint）
    const intFields = new Set([
      'countdownSeconds',
      'winnerPercent',
      'platformPercent',
      'purchaseRateLimitPerMin',
      'withdrawRequirePurchaseCount',
      'withdrawCooldownHours',
      'botPurchaseIntervalMs',
    ]);
    for (const [k, v] of Object.entries(hash)) {
      if (bigintFields.has(k)) {
        result[k] = BigInt(v);
      } else if (stringFields.has(k)) {
        result[k] = v;
      } else if (intFields.has(k)) {
        result[k] = parseInt(v, 10);
      } else if (v === 'true' || v === 'false') {
        result[k] = v === 'true';
      } else if (!isNaN(Number(v)) && v !== '' && !isNaN(parseFloat(v))) {
        result[k] = Number(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  // 便捷方法
  async getMinBuyAmount(): Promise<bigint> {
    const cfg = await this.getGameConfig();
    return cfg?.minBuyAmount ?? 100n;
  }

  async getCountdownSeconds(): Promise<number> {
    const cfg = await this.getGameConfig();
    return cfg?.countdownSeconds ?? 60;
  }
}
