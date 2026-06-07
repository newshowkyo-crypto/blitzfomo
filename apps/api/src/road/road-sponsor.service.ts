import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemLogService } from '../system-log/system-log.service';
import { RoadTreasuryService } from './road-treasury.service';
import { RoadTreasuryBucket, RoadTreasuryEventType } from '@prisma/client';

@Injectable()
export class RoadSponsorService {
  readonly seasonCode = 'WC2026';

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemLog: SystemLogService,
    private readonly treasury: RoadTreasuryService,
  ) {}

  async getGlobalBudget() {
    const row = await this.prisma.officialSponsorBudget.findUnique({ where: { seasonCode: this.seasonCode } });
    if (!row) throw new BadRequestException('Official sponsor budget not configured');
    return row;
  }

  async updateGlobalBudget(operatorAdminId: string, input: { totalBudget?: bigint; status?: string; resetUsed?: boolean }) {
    const totalBudget = input.totalBudget !== undefined ? input.totalBudget : undefined;
    const status = input.status ? String(input.status) : undefined;
    const resetUsed = input.resetUsed ?? false;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.officialSponsorBudget.findUnique({ where: { seasonCode: this.seasonCode } });
      if (!existing) {
        if (totalBudget === undefined || totalBudget <= 0n) {
          throw new BadRequestException('totalBudget must be configured');
        }
        return tx.officialSponsorBudget.create({
          data: {
            seasonCode: this.seasonCode,
            totalBudget,
            usedBudget: 0n,
            remainingBudget: totalBudget,
            status: (status as any) ?? 'ACTIVE',
          },
        });
      }

      const nextUsed = resetUsed ? 0n : existing.usedBudget;
      const nextTotal = totalBudget !== undefined ? totalBudget : existing.totalBudget;
      if (nextTotal < nextUsed) {
        throw new BadRequestException('totalBudget cannot be less than usedBudget');
      }
      const nextStatus = status !== undefined ? (status as any) : existing.status;
      return tx.officialSponsorBudget.update({
        where: { seasonCode: this.seasonCode },
        data: {
          totalBudget: totalBudget !== undefined ? totalBudget : undefined,
          usedBudget: resetUsed ? 0n : undefined,
          remainingBudget: nextTotal - nextUsed,
          status: nextStatus,
        },
      });
    });

    await this.systemLog.warn('road', 'Official sponsor global budget updated', {
      operatorAdminId,
      seasonCode: this.seasonCode,
      totalBudget: updated.totalBudget,
      usedBudget: updated.usedBudget,
      remainingBudget: updated.remainingBudget,
      status: updated.status,
    });

    return updated;
  }

  async sponsorPool(operatorAdminId: string, poolId: string, amount: bigint, input?: { note?: string; reference?: string }) {
    if (amount <= 0n) {
      throw new BadRequestException('Amount must be positive');
    }

    const reference = input?.reference ? String(input.reference) : null;
    if (process.env.NODE_ENV === 'production' && !reference) {
      throw new BadRequestException('Sponsor reference required in production');
    }
    if (reference) {
      const existing = await this.prisma.sponsorLedger.findUnique({ where: { reference } });
      if (existing) {
        const pool = await this.prisma.roadPool.findUnique({ where: { id: existing.poolId }, include: { team: true } });
        return { success: true, duplicate: true, pool, sponsorLedgerId: existing.id };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const budgetLocked = await tx.$queryRaw<Array<{ id: string; season_code: string; total_budget: bigint; used_budget: bigint; remaining_budget: bigint; status: string }>>`
        SELECT id, season_code, total_budget, used_budget, remaining_budget, status
        FROM official_sponsor_budget
        WHERE season_code = ${this.seasonCode}
        FOR UPDATE
      `;
      const budget = budgetLocked[0];
      if (!budget) throw new BadRequestException('Official sponsor global budget not configured');
      if (String(budget.status) !== 'ACTIVE') throw new BadRequestException('Official sponsor global budget not active');
      if (budget.remaining_budget < amount) throw new BadRequestException('Official sponsor global budget exceeded');

      const locked = await tx.$queryRaw<Array<{ id: string; sponsorAmount: bigint; sponsorBudgetLimit: bigint; prizePool: bigint }>>`
        SELECT id, "sponsorAmount", "sponsorBudgetLimit", "prizePool"
        FROM road_pools
        WHERE id = ${poolId}
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) throw new BadRequestException('Pool not found');

      const current = row.sponsorAmount ?? 0n;
      const limit = row.sponsorBudgetLimit ?? 0n;
      if (limit <= 0n) {
        throw new BadRequestException('Sponsor budget limit not configured');
      }
      if (current + amount > limit) {
        throw new BadRequestException('Sponsor budget limit exceeded');
      }

      if (reference) {
        const dup = await tx.sponsorLedger.findUnique({ where: { reference } });
        if (dup) {
          const pool = await tx.roadPool.findUnique({ where: { id: dup.poolId }, include: { team: true } });
          return { updated: pool, sponsorLedgerId: dup.id, duplicate: true };
        }
      }

      const sponsorLedger = await tx.sponsorLedger.create({
        data: {
          poolId,
          amount,
          source: 'OFFICIAL',
          operatorId: operatorAdminId,
          reference,
          note: input?.note ? String(input.note) : null,
        },
      });

      const updated = await tx.roadPool.update({
        where: { id: poolId },
        data: {
          sponsorAmount: { increment: amount },
          prizePool: { increment: amount },
        },
        include: { team: true },
      });

      await tx.officialSponsorBudget.update({
        where: { id: budget.id },
        data: {
          usedBudget: { increment: amount },
          remainingBudget: { decrement: amount },
        },
      });

      await this.treasury.record(tx, {
        eventType: RoadTreasuryEventType.SPONSOR_INJECT,
        eventId: sponsorLedger.id,
        entries: [
          { bucket: RoadTreasuryBucket.OFFICIAL_SPONSOR_COST, amount, poolId, sponsorLedgerId: sponsorLedger.id },
          { bucket: RoadTreasuryBucket.POOL_PRIZE, amount, poolId, sponsorLedgerId: sponsorLedger.id },
        ],
      });

      await this.systemLog.info('road', 'Official sponsor injected', {
        poolId,
        team: updated.team.code,
        stage: updated.stage,
        amount,
        sponsorTotal: updated.sponsorAmount,
        operatorAdminId,
        reference,
      });

      return { updated, sponsorLedgerId: sponsorLedger.id };
    });

    return {
      success: true,
      duplicate: (result as any).duplicate ?? false,
      pool: (result as any).updated,
      sponsorLedgerId: (result as any).sponsorLedgerId,
    };
  }
}
