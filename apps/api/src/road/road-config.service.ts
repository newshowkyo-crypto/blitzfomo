import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { SystemLogService } from '../system-log/system-log.service';
import { RoadEconomyMode } from '@prisma/client';

@Injectable()
export class RoadConfigService {
  readonly seasonCode = 'WC2026';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly systemLog: SystemLogService,
  ) {}

  async get() {
    const cfg = await this.prisma.roadConfig.findUnique({ where: { seasonCode: this.seasonCode } });
    if (!cfg) throw new BadRequestException('Road config not initialized');
    return cfg;
  }

  async update(operatorAdminId: string, body: any) {
    const existing = await this.get();

    const next = {
      // Economy Mode
      economyMode: body.economyMode ?? existing.economyMode,
      
      // House Fee Settings
      baseHouseFeeBps: body.baseHouseFeeBps ?? existing.baseHouseFeeBps,
      minHouseFeeBps: body.minHouseFeeBps ?? existing.minHouseFeeBps,
      maxHouseFeeBps: body.maxHouseFeeBps ?? existing.maxHouseFeeBps,
      
      // Dividend Settings
      baseDividendBps: body.baseDividendBps ?? existing.baseDividendBps,
      minDividendBps: body.minDividendBps ?? existing.minDividendBps,
      maxDividendBps: body.maxDividendBps ?? existing.maxDividendBps,
      
      // Fund Allocation Base
      prizeBps: body.prizeBps ?? existing.prizeBps,
      superBps: body.superBps ?? existing.superBps,
      reinvestBps: body.reinvestBps ?? existing.reinvestBps,
      agentBps: body.agentBps ?? existing.agentBps,
      reserveBps: body.reserveBps ?? existing.reserveBps,
      
      // Dynamic Range Limits
      minSuperBps: body.minSuperBps ?? existing.minSuperBps,
      maxSuperBps: body.maxSuperBps ?? existing.maxSuperBps,
      minReserveBps: body.minReserveBps ?? existing.minReserveBps,
      maxReserveBps: body.maxReserveBps ?? existing.maxReserveBps,
      
      // Special Allocation
      dailyRushBps: body.dailyRushBps ?? existing.dailyRushBps,
      megaPoolBps: body.megaPoolBps ?? existing.megaPoolBps,
      
      // Pressure & Growth Settings
      withdrawalPressureThresholdBps: body.withdrawalPressureThresholdBps ?? existing.withdrawalPressureThresholdBps,
      volumeGrowthBoostCapBps: body.volumeGrowthBoostCapBps ?? existing.volumeGrowthBoostCapBps,
      
      // Release Delay Settings
      releaseDelayHours: body.releaseDelayHours ?? existing.releaseDelayHours,
      releaseDelayMinHours: body.releaseDelayMinHours ?? existing.releaseDelayMinHours,
      releaseDelayMaxHours: body.releaseDelayMaxHours ?? existing.releaseDelayMaxHours,
      
      // Risk Settings
      lowCoverageThresholdBps: body.lowCoverageThresholdBps ?? existing.lowCoverageThresholdBps,
      
      // Budget
      sponsorGlobalBudget: body.sponsorGlobalBudget !== undefined ? BigInt(body.sponsorGlobalBudget) : existing.sponsorGlobalBudget,
    };

    // Validate economy mode
    if (!Object.values(RoadEconomyMode).includes(next.economyMode)) {
      throw new BadRequestException('Invalid economyMode');
    }

    // Validate bps ranges
    if (Number(next.minHouseFeeBps) < 0 || Number(next.maxHouseFeeBps) < 0) {
      throw new BadRequestException('House fee bps must be non-negative');
    }
    if (Number(next.maxHouseFeeBps) < Number(next.minHouseFeeBps)) {
      throw new BadRequestException('maxHouseFeeBps must be >= minHouseFeeBps');
    }
    if (Number(next.baseHouseFeeBps) < Number(next.minHouseFeeBps) || Number(next.baseHouseFeeBps) > Number(next.maxHouseFeeBps)) {
      throw new BadRequestException('baseHouseFeeBps must be between minHouseFeeBps and maxHouseFeeBps');
    }

    if (Number(next.minDividendBps) < 0 || Number(next.maxDividendBps) < 0) {
      throw new BadRequestException('Dividend bps must be non-negative');
    }
    if (Number(next.maxDividendBps) < Number(next.minDividendBps)) {
      throw new BadRequestException('maxDividendBps must be >= minDividendBps');
    }
    if (Number(next.baseDividendBps) < Number(next.minDividendBps) || Number(next.baseDividendBps) > Number(next.maxDividendBps)) {
      throw new BadRequestException('baseDividendBps must be between minDividendBps and maxDividendBps');
    }

    // Validate net split sum
    const netSplitSum =
      Number(next.prizeBps) +
      Number(next.baseDividendBps) +
      Number(next.superBps) +
      Number(next.reinvestBps) +
      Number(next.agentBps) +
      Number(next.reserveBps);
    if (netSplitSum !== 10000) {
      throw new BadRequestException('Net split bps must sum to 10000');
    }

    // Validate release delay
    if (Number(next.releaseDelayMinHours) < 0 || Number(next.releaseDelayMaxHours) < 0) {
      throw new BadRequestException('Release delay hours must be non-negative');
    }
    if (Number(next.releaseDelayMaxHours) < Number(next.releaseDelayMinHours)) {
      throw new BadRequestException('releaseDelayMaxHours must be >= releaseDelayMinHours');
    }
    if (Number(next.releaseDelayHours) < Number(next.releaseDelayMinHours) || Number(next.releaseDelayHours) > Number(next.releaseDelayMaxHours)) {
      throw new BadRequestException('releaseDelayHours must be between releaseDelayMinHours and releaseDelayMaxHours');
    }

    const updated = await this.prisma.roadConfig.update({
      where: { seasonCode: this.seasonCode },
      data: next,
    });

    await this.config.refreshAllConfigs();
    await this.systemLog.info('road', 'Road config updated', { operatorAdminId, seasonCode: this.seasonCode });
    return updated;
  }

  async getEconomyMode() {
    const cfg = await this.get();
    return cfg.economyMode;
  }

  async setEconomyMode(operatorAdminId: string, mode: RoadEconomyMode) {
    if (!Object.values(RoadEconomyMode).includes(mode)) {
      throw new BadRequestException('Invalid economyMode');
    }
    
    const updated = await this.prisma.roadConfig.update({
      where: { seasonCode: this.seasonCode },
      data: { economyMode: mode },
    });

    await this.config.refreshAllConfigs();
    await this.systemLog.info('road', 'Road economy mode updated', { operatorAdminId, seasonCode: this.seasonCode, mode });
    return updated;
  }
}