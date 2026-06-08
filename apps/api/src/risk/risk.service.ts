// apps/api/src/risk/risk.service.ts
// 风控服务（简化版，实际应更复杂）

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async checkPurchaseRisk(userId: string, amount: bigint): Promise<{ allowed: boolean; reason?: string }> {
    const riskCfg = await this.config.getRiskConfig();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) return { allowed: false, reason: 'User not found' };

    // 示例：单笔限额
    if (riskCfg && amount > (riskCfg.purchaseMaxAmountPerTx || 1000000n)) {
      return { allowed: false, reason: 'Amount exceeds per-transaction limit' };
    }

    // TODO: 更复杂的频次检查、IP 黑名单等
    const perMinuteLimit = riskCfg?.purchaseRateLimitPerMin || 10;
    const rateKey = `risk:purchase:${userId}:${Math.floor(Date.now() / 60000)}`;
    const current = await this.redis.getClient().incr(rateKey);
    if (current === 1) {
      await this.redis.getClient().expire(rateKey, 90);
    }
    if (current > perMinuteLimit) {
      return { allowed: false, reason: 'Purchase rate limit exceeded' };
    }

    return { allowed: true };
  }

  async checkWithdrawRisk(userId: string, amount: bigint): Promise<{ allowed: boolean; reason?: string; score: number }> {
    const riskCfg = await this.config.getRiskConfig();

    // 1. 检查购买次数（旧版 purchase + Road purchase 均计入真实消费行为）
    const [classicPurchaseCount, roadPurchaseCount] = await Promise.all([
      this.prisma.purchase.count({
        where: {
          userId,
          isBot: false,
        },
      }),
      this.prisma.roadPurchase.count({
        where: { userId },
      }),
    ]);
    const purchaseCount = classicPurchaseCount + roadPurchaseCount;

    const requiredPurchases = riskCfg?.withdrawRequirePurchaseCount || 3;
    if (purchaseCount < requiredPurchases) {
      return {
        allowed: false,
        score: 100,
        reason: `需要至少 ${requiredPurchases} 次购买才能提现，当前 ${purchaseCount} 次`
      };
    }

    // 2. 检查提现冷却时间
    const lastWithdraw = await this.prisma.withdrawal.findFirst({
      where: {
        userId,
        status: { in: ['PAID', 'APPROVED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (lastWithdraw) {
      const cooldownHours = riskCfg?.withdrawCooldownHours || 24;
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      const timeSinceLastWithdraw = Date.now() - lastWithdraw.createdAt.getTime();

      if (timeSinceLastWithdraw < cooldownMs) {
        const remainingHours = Math.ceil((cooldownMs - timeSinceLastWithdraw) / 3600000);
        return {
          allowed: false,
          score: 100,
          reason: `提现冷却中，请在 ${remainingHours} 小时后重试`
        };
      }
    }

    // 3. 检查最低提现金额
    const minAmount = riskCfg?.withdrawMinAmount || 1000n; // 10 USDT
    if (amount < minAmount) {
      return {
        allowed: false,
        score: 100,
        reason: `提现金额不能低于 ${Number(minAmount) / 100} USDT`
      };
    }

    // 4. 检查每日提现限额
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayWithdrawn = await this.prisma.withdrawal.aggregate({
      where: {
        userId,
        status: { in: ['PAID', 'APPROVED', 'PENDING_REVIEW'] },
        createdAt: { gte: today }
      },
      _sum: { amountUsdt: true }
    });

    const dailyLimit = riskCfg?.withdrawMaxAmountDaily || 100000n; // 1000 USDT
    const todayTotal = (todayWithdrawn._sum.amountUsdt || 0n) + amount;

    if (todayTotal > dailyLimit) {
      return {
        allowed: false,
        score: 100,
        reason: `超过每日提现限额 ${Number(dailyLimit) / 100} USDT`
      };
    }

    // 5. 风险评分（可扩展）
    let score = 0;

    // 购买次数越少，风险越高
    if (purchaseCount < 10) {
      score += 20;
    }

    const allowed = score < 70;
    return { allowed, score, reason: allowed ? undefined : '风险评分过高' };
  }
}
