import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { RoadStage, RoadEconomyMode } from '@prisma/client';
import { RoadTreasuryService } from './road-treasury.service';

export interface DynamicEconomyResult {
  economyMode: RoadEconomyMode;
  growthFactor: number;
  poolHealthFactor: number;
  retentionFactor: number;
  stageFactor: number;
  finalDividendBps: number;
  finalHouseFeeBps: number;
  finalSuperBps: number;
  finalReserveBps: number;
  releaseDelayHours: number;
}

export interface EconomyContext {
  stage: RoadStage;
  reserveCoverageRatio: number;
  volume24h: bigint;
  avgVolume72h: bigint;
  pendingWithdrawals24h: bigint;
  totalPurchases24h: bigint;
}

@Injectable()
export class RoadEconomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly treasury: RoadTreasuryService,
  ) {}

  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  stageFactor(stage: RoadStage): number {
    switch (stage) {
      case RoadStage.TOP32:
        return 1.15;
      case RoadStage.TOP16:
        return 1.05;
      case RoadStage.TOP8:
        return 0.95;
      case RoadStage.TOP4:
        return 0.85;
      case RoadStage.FINAL:
        return 0.75;
      case RoadStage.CHAMPION:
        return 0.70;
      default:
        return 1.0;
    }
  }

  growthFactor(volume24h: bigint, avgVolume72h: bigint): number {
    if (avgVolume72h <= 0n) return 1.0;
    const ratio = Number(volume24h) / Number(avgVolume72h);
    return this.clamp(ratio, 0.75, 1.25);
  }

  poolHealthFactor(reserveCoverageRatio: number): number {
    return this.clamp(reserveCoverageRatio, 0.50, 1.00);
  }

  retentionFactor(
    pendingWithdrawals24h: bigint,
    totalPurchases24h: bigint,
    thresholdBps: number,
  ): number {
    if (totalPurchases24h <= 0n) return 1.0;
    
    const withdrawalPressure = Number(pendingWithdrawals24h) / Number(totalPurchases24h);
    const threshold = thresholdBps / 10000;
    
    if (withdrawalPressure <= threshold * 0.5) {
      return 1.0;
    } else if (withdrawalPressure <= threshold) {
      return 1.0 - (withdrawalPressure - threshold * 0.5) / threshold;
    } else {
      return this.clamp(0.6 - (withdrawalPressure - threshold) * 0.2, 0.3, 0.8);
    }
  }

  async buildContext(stage: RoadStage): Promise<EconomyContext> {
    const now = new Date();
    const [vol24hAgg, vol72hAgg, withdraw24hAgg, purchase24hAgg, balances] = await Promise.all([
      this.prisma.roadPurchase.aggregate({
        where: { createdAt: { gte: new Date(now.getTime() - 24 * 3600000) } },
        _sum: { amount: true },
      }),
      this.prisma.roadPurchase.aggregate({
        where: { createdAt: { gte: new Date(now.getTime() - 72 * 3600000) } },
        _sum: { amount: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { createdAt: { gte: new Date(now.getTime() - 24 * 3600000) } },
        _sum: { amountUsdt: true },
      }),
      this.prisma.roadPurchase.aggregate({
        where: { createdAt: { gte: new Date(now.getTime() - 24 * 3600000) } },
        _sum: { amount: true },
      }),
      this.treasury.getBalances(this.prisma),
    ]);

    const vol24h = vol24hAgg._sum.amount ?? 0n;
    const vol72h = vol72hAgg._sum.amount ?? 0n;
    const avg72h = vol72h > 0n ? vol72h / 3n : 0n;
    const balancesObj = balances as { reserveCoverageRatio: number };

    return {
      stage,
      reserveCoverageRatio: balancesObj.reserveCoverageRatio,
      volume24h: vol24h,
      avgVolume72h: avg72h,
      pendingWithdrawals24h: withdraw24hAgg._sum.amountUsdt ?? 0n,
      totalPurchases24h: purchase24hAgg._sum.amount ?? 0n,
    };
  }

  async calculateDynamicEconomy(stage: RoadStage): Promise<DynamicEconomyResult> {
    const roadConfig = await this.config.getRoadConfig('WC2026');
    if (!roadConfig) {
      throw new Error('Road config not initialized');
    }

    const context = await this.buildContext(stage);

    const growthFactor = this.growthFactor(context.volume24h, context.avgVolume72h);
    const poolHealthFactor = this.poolHealthFactor(context.reserveCoverageRatio);
    const retentionFactor = this.retentionFactor(
      context.pendingWithdrawals24h,
      context.totalPurchases24h,
      Number(roadConfig.withdrawalPressureThresholdBps),
    );
    const stageFactor = this.stageFactor(stage);

    const baseDividendBps = Number(roadConfig.baseDividendBps);
    let finalDividendBps = baseDividendBps * growthFactor * poolHealthFactor * retentionFactor * stageFactor;
    finalDividendBps = this.clamp(
      finalDividendBps,
      Number(roadConfig.minDividendBps),
      Number(roadConfig.maxDividendBps),
    );

    const modeAdjustment = this.getModeAdjustment(roadConfig.economyMode);
    finalDividendBps = this.clamp(
      finalDividendBps * modeAdjustment.dividendMultiplier,
      modeAdjustment.minDividendBps,
      modeAdjustment.maxDividendBps,
    );

    let finalHouseFeeBps = this.calculateHouseFee(
      Number(roadConfig.baseHouseFeeBps),
      Number(roadConfig.minHouseFeeBps),
      Number(roadConfig.maxHouseFeeBps),
      context.reserveCoverageRatio,
      Number(roadConfig.lowCoverageThresholdBps) / 10000,
      growthFactor,
      Number(roadConfig.volumeGrowthBoostCapBps),
    );
    finalHouseFeeBps = this.clamp(
      finalHouseFeeBps * modeAdjustment.houseFeeMultiplier,
      modeAdjustment.minHouseFeeBps,
      modeAdjustment.maxHouseFeeBps,
    );

    let finalSuperBps = this.calculateSuperBps(
      Number(roadConfig.superBps),
      Number(roadConfig.minSuperBps),
      Number(roadConfig.maxSuperBps),
      context.reserveCoverageRatio,
      stageFactor,
    );
    finalSuperBps = this.clamp(
      finalSuperBps * modeAdjustment.superMultiplier,
      modeAdjustment.minSuperBps,
      modeAdjustment.maxSuperBps,
    );

    let finalReserveBps = this.calculateReserveBps(
      Number(roadConfig.reserveBps),
      Number(roadConfig.minReserveBps),
      Number(roadConfig.maxReserveBps),
      context.reserveCoverageRatio,
      Number(roadConfig.lowCoverageThresholdBps) / 10000,
    );
    finalReserveBps = this.clamp(
      finalReserveBps * modeAdjustment.reserveMultiplier,
      modeAdjustment.minReserveBps,
      modeAdjustment.maxReserveBps,
    );

    const releaseDelayHours = this.calculateReleaseDelay(
      Number(roadConfig.releaseDelayHours),
      Number(roadConfig.releaseDelayMinHours),
      Number(roadConfig.releaseDelayMaxHours),
      context.reserveCoverageRatio,
      Number(roadConfig.lowCoverageThresholdBps) / 10000,
      retentionFactor,
    );

    return {
      economyMode: roadConfig.economyMode,
      growthFactor: Math.round(growthFactor * 1000) / 1000,
      poolHealthFactor: Math.round(poolHealthFactor * 1000) / 1000,
      retentionFactor: Math.round(retentionFactor * 1000) / 1000,
      stageFactor,
      finalDividendBps: Math.round(finalDividendBps),
      finalHouseFeeBps: Math.round(finalHouseFeeBps),
      finalSuperBps: Math.round(finalSuperBps),
      finalReserveBps: Math.round(finalReserveBps),
      releaseDelayHours: Math.round(releaseDelayHours),
    };
  }

  private getModeAdjustment(mode: RoadEconomyMode) {
    switch (mode) {
      case RoadEconomyMode.COLD_START:
        return {
          dividendMultiplier: 1.15,
          minDividendBps: 2600,
          maxDividendBps: 3200,
          houseFeeMultiplier: 0.8,
          minHouseFeeBps: 500,
          maxHouseFeeBps: 800,
          superMultiplier: 0.85,
          minSuperBps: 1800,
          maxSuperBps: 2200,
          reserveMultiplier: 0.9,
          minReserveBps: 500,
          maxReserveBps: 800,
        };
      case RoadEconomyMode.NORMAL_GROWTH:
        return {
          dividendMultiplier: 1.0,
          minDividendBps: 1800,
          maxDividendBps: 2500,
          houseFeeMultiplier: 1.0,
          minHouseFeeBps: 800,
          maxHouseFeeBps: 1000,
          superMultiplier: 1.0,
          minSuperBps: 2500,
          maxSuperBps: 3000,
          reserveMultiplier: 1.0,
          minReserveBps: 800,
          maxReserveBps: 1000,
        };
      case RoadEconomyMode.KNOCKOUT_FOMO:
        return {
          dividendMultiplier: 0.75,
          minDividendBps: 1000,
          maxDividendBps: 1800,
          houseFeeMultiplier: 1.3,
          minHouseFeeBps: 1000,
          maxHouseFeeBps: 1500,
          superMultiplier: 1.3,
          minSuperBps: 3000,
          maxSuperBps: 4000,
          reserveMultiplier: 1.3,
          minReserveBps: 1000,
          maxReserveBps: 1500,
        };
      case RoadEconomyMode.FINAL_RUSH:
        return {
          dividendMultiplier: 0.5,
          minDividendBps: 600,
          maxDividendBps: 1200,
          houseFeeMultiplier: 1.6,
          minHouseFeeBps: 1200,
          maxHouseFeeBps: 1800,
          superMultiplier: 1.5,
          minSuperBps: 3500,
          maxSuperBps: 4500,
          reserveMultiplier: 1.6,
          minReserveBps: 1200,
          maxReserveBps: 1800,
        };
      default:
        return {
          dividendMultiplier: 1.0,
          minDividendBps: 600,
          maxDividendBps: 3200,
          houseFeeMultiplier: 1.0,
          minHouseFeeBps: 500,
          maxHouseFeeBps: 2000,
          superMultiplier: 1.0,
          minSuperBps: 1000,
          maxSuperBps: 4500,
          reserveMultiplier: 1.0,
          minReserveBps: 500,
          maxReserveBps: 1800,
        };
    }
  }

  private calculateHouseFee(
    baseBps: number,
    minBps: number,
    maxBps: number,
    reserveCoverage: number,
    threshold: number,
    growthFactor: number,
    boostCapBps: number,
  ): number {
    let fee = baseBps;

    if (reserveCoverage < threshold) {
      const deficit = threshold - reserveCoverage;
      fee += deficit * 600;
    }

    if (growthFactor > 1) {
      fee -= Math.min((growthFactor - 1) * boostCapBps, boostCapBps);
    }

    return this.clamp(fee, minBps, maxBps);
  }

  private calculateSuperBps(
    baseBps: number,
    minBps: number,
    maxBps: number,
    reserveCoverage: number,
    stageFactor: number,
  ): number {
    let superBps = baseBps;

    if (stageFactor < 1) {
      superBps *= (1 + (1 - stageFactor) * 2);
    }

    if (reserveCoverage >= 1) {
      superBps *= 1.1;
    }

    return this.clamp(superBps, minBps, maxBps);
  }

  private calculateReserveBps(
    baseBps: number,
    minBps: number,
    maxBps: number,
    reserveCoverage: number,
    threshold: number,
  ): number {
    let reserve = baseBps;

    if (reserveCoverage < threshold) {
      const deficit = threshold - reserveCoverage;
      reserve += deficit * 800;
    }

    return this.clamp(reserve, minBps, maxBps);
  }

  private calculateReleaseDelay(
    baseHours: number,
    minHours: number,
    maxHours: number,
    reserveCoverage: number,
    threshold: number,
    retentionFactor: number,
  ): number {
    let delay = baseHours;

    if (reserveCoverage < threshold) {
      const factor = 1 + (threshold - reserveCoverage) * 2;
      delay *= factor;
    }

    if (retentionFactor < 0.8) {
      const penalty = 1 + (0.8 - retentionFactor) * 2;
      delay *= penalty;
    }

    return this.clamp(delay, minHours, maxHours);
  }

  async getEconomyOverview() {
    const roadConfig = await this.config.getRoadConfig('WC2026');
    if (!roadConfig) {
      throw new Error('Road config not initialized');
    }

    const context = await this.buildContext(RoadStage.TOP32);

    const growthFactor = this.growthFactor(context.volume24h, context.avgVolume72h);
    const poolHealthFactor = this.poolHealthFactor(context.reserveCoverageRatio);
    const retentionFactor = this.retentionFactor(
      context.pendingWithdrawals24h,
      context.totalPurchases24h,
      Number(roadConfig.withdrawalPressureThresholdBps),
    );

    const volumeGrowthPercent = growthFactor > 1 ? (growthFactor - 1) * 100 : (1 - growthFactor) * -100;
    const withdrawalPressure = context.totalPurchases24h > 0n
      ? (Number(context.pendingWithdrawals24h) / Number(context.totalPurchases24h)) * 100
      : 0;

    const recommendedMode = this.recommendMode(
      growthFactor,
      context.reserveCoverageRatio,
      withdrawalPressure,
    );

    const economyResult = await this.calculateDynamicEconomy(RoadStage.TOP32);

    return {
      currentMode: roadConfig.economyMode,
      recommendedMode,
      metrics: {
        reserveCoverage: Math.round(context.reserveCoverageRatio * 100) / 100,
        volumeGrowth: Math.round(volumeGrowthPercent * 100) / 100,
        withdrawalPressure: Math.round(withdrawalPressure * 100) / 100,
        growthFactor: Math.round(growthFactor * 1000) / 1000,
        poolHealthFactor: Math.round(poolHealthFactor * 1000) / 1000,
        retentionFactor: Math.round(retentionFactor * 1000) / 1000,
      },
      finalDividendBps: economyResult.finalDividendBps,
      finalHouseFeeBps: economyResult.finalHouseFeeBps,
      finalSuperBps: economyResult.finalSuperBps,
      finalReserveBps: economyResult.finalReserveBps,
      finalPrizeBps: 0,
      finalDailyRushBps: Number(roadConfig.dailyRushBps) || 0,
      finalMegaPoolBps: Number(roadConfig.megaPoolBps) || 0,
      totalNetBps: 10000,
    };
  }

  private recommendMode(
    growthFactor: number,
    reserveCoverage: number,
    withdrawalPressurePercent: number,
  ): RoadEconomyMode {
    if (withdrawalPressurePercent > 50) {
      return RoadEconomyMode.FINAL_RUSH;
    }

    if (growthFactor < 0.85 && reserveCoverage >= 1.2) {
      return RoadEconomyMode.COLD_START;
    }

    if (growthFactor >= 0.9 && growthFactor <= 1.1) {
      return RoadEconomyMode.NORMAL_GROWTH;
    }

    if (growthFactor > 1.1 || reserveCoverage < 0.8) {
      return RoadEconomyMode.KNOCKOUT_FOMO;
    }

    return RoadEconomyMode.NORMAL_GROWTH;
  }
}