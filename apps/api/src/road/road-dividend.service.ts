import { Injectable } from '@nestjs/common';
import { Prisma, RewardStatus, RoadDividendSource } from '@prisma/client';

function isBotIdentity(user: { walletAddress: string; nickname: string | null }) {
  const wallet = (user.walletAddress || '').toLowerCase();
  const nickname = (user.nickname || '').toLowerCase();
  return wallet.startsWith('bot:') || wallet.startsWith('0xbot') || nickname.startsWith('bot_');
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

@Injectable()
export class RoadDividendService {
  async distributeFromPurchase(tx: Prisma.TransactionClient, input: {
    poolId: string;
    purchaseId: string;
    buyerUserId: string;
    dividendBudget: bigint;
    currentPrice: bigint;
    releaseDelayHours: number;
    beta: number;
    ageBoostCap: number;
    now: Date;
  }) {
    if (input.dividendBudget <= 0n) {
      return { distributed: 0n, recipients: 0 };
    }

    const holdings = await tx.roadKeyHolding.findMany({
      where: {
        poolId: input.poolId,
        status: 'ACTIVE',
        userId: { not: input.buyerUserId },
        keyAmount: { gt: new Prisma.Decimal(0) },
      },
      include: { user: { select: { walletAddress: true, nickname: true } } },
      take: 5000,
    });

    const eligible = holdings.filter((h) => !isBotIdentity(h.user));
    if (eligible.length === 0) {
      return { distributed: 0n, recipients: 0 };
    }

    const currentPriceN = Number(input.currentPrice);
    const nowMs = input.now.getTime();

    const weights = eligible.map((h) => {
      const holdingHours = Math.max(0, (nowMs - h.createdAt.getTime()) / 3600000);
      const ageBoost = clampNumber(1 + input.beta * Math.log(1 + holdingHours), 1, input.ageBoostCap);
      const entryDiscountBoost = clampNumber(currentPriceN / Math.max(1, Number(h.avgEntryPrice)), 1, 2);
      const weight =
        Number(h.keyAmount) *
        ageBoost *
        Number(h.genesisBoost) *
        entryDiscountBoost;
      return { holdingId: h.id, userId: h.userId, weight: Math.max(0, weight) };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight <= 0) {
      return { distributed: 0n, recipients: 0 };
    }

    let distributed = 0n;
    const parts: Array<{ holdingId: string; userId: string; amount: bigint; weight: Prisma.Decimal }> = [];

    for (const w of weights) {
      const part = BigInt(Math.floor(Number(input.dividendBudget) * (w.weight / totalWeight)));
      if (part <= 0n) continue;
      distributed += part;
      parts.push({ holdingId: w.holdingId, userId: w.userId, amount: part, weight: new Prisma.Decimal(w.weight.toString()) });
    }

    if (parts.length === 0) {
      return { distributed: 0n, recipients: 0 };
    }

    const remainder = input.dividendBudget - distributed;
    if (remainder > 0n) {
      parts[0].amount += remainder;
      distributed += remainder;
    }

    const releaseAt = new Date(input.now.getTime() + Math.max(0, input.releaseDelayHours) * 3600000);

    await tx.roadDividend.createMany({
      data: parts.map((p) => ({
        source: RoadDividendSource.PURCHASE,
        purchaseId: input.purchaseId,
        poolId: input.poolId,
        userId: p.userId,
        amount: p.amount,
        weight: p.weight,
        status: RewardStatus.PENDING_RELEASE,
        releaseAt,
      })),
    });

    for (const p of parts) {
      await tx.roadKeyHolding.update({
        where: { id: p.holdingId },
        data: { pendingReward: { increment: p.amount } },
      });
    }

    return { distributed, recipients: parts.length };
  }

  async distributeStageReward(tx: Prisma.TransactionClient, input: {
    poolId: string;
    rewardBudget: bigint;
    releaseDelayHours: number;
    beta: number;
    ageBoostCap: number;
    now: Date;
  }) {
    if (input.rewardBudget <= 0n) {
      return { distributed: 0n, recipients: 0 };
    }

    const holdings = await tx.roadKeyHolding.findMany({
      where: {
        poolId: input.poolId,
        status: 'ACTIVE',
        keyAmount: { gt: new Prisma.Decimal(0) },
      },
      include: { user: { select: { walletAddress: true, nickname: true } } },
      take: 5000,
    });

    const eligible = holdings.filter((h) => !isBotIdentity(h.user));
    if (eligible.length === 0) {
      return { distributed: 0n, recipients: 0 };
    }

    const nowMs = input.now.getTime();
    const weights = eligible.map((h) => {
      const holdingHours = Math.max(0, (nowMs - h.createdAt.getTime()) / 3600000);
      const ageBoost = clampNumber(1 + input.beta * Math.log(1 + holdingHours), 1, input.ageBoostCap);
      const weight =
        Number(h.keyAmount) *
        ageBoost *
        Number(h.genesisBoost);
      return { holdingId: h.id, userId: h.userId, weight: Math.max(0, weight) };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight <= 0) {
      return { distributed: 0n, recipients: 0 };
    }

    let distributed = 0n;
    const parts: Array<{ holdingId: string; userId: string; amount: bigint; weight: Prisma.Decimal }> = [];

    for (const w of weights) {
      const part = BigInt(Math.floor(Number(input.rewardBudget) * (w.weight / totalWeight)));
      if (part <= 0n) continue;
      distributed += part;
      parts.push({ holdingId: w.holdingId, userId: w.userId, amount: part, weight: new Prisma.Decimal(w.weight.toString()) });
    }

    if (parts.length === 0) {
      return { distributed: 0n, recipients: 0 };
    }

    const remainder = input.rewardBudget - distributed;
    if (remainder > 0n) {
      parts[0].amount += remainder;
      distributed += remainder;
    }

    const releaseAt = new Date(input.now.getTime() + Math.max(0, input.releaseDelayHours) * 3600000);

    await tx.roadDividend.createMany({
      data: parts.map((p) => ({
        source: RoadDividendSource.STAGE_REWARD,
        purchaseId: null,
        poolId: input.poolId,
        userId: p.userId,
        amount: p.amount,
        weight: p.weight,
        status: RewardStatus.PENDING_RELEASE,
        releaseAt,
      })),
    });

    for (const p of parts) {
      await tx.roadKeyHolding.update({
        where: { id: p.holdingId },
        data: { pendingReward: { increment: p.amount } },
      });
    }

    return { distributed, recipients: parts.length };
  }
}
