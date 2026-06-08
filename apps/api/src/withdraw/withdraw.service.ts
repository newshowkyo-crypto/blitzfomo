// apps/api/src/withdraw/withdraw.service.ts
// 提现状态机 + 风控（简化版，完整版需更多规则）

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RiskService } from '../risk/risk.service';
import { WithdrawalStatus, LedgerType } from '@prisma/client';
import { CreateWithdrawDto } from '@blitz/shared/dto/withdraw.dto';

@Injectable()
export class WithdrawService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly riskService: RiskService,
  ) {}

  async createWithdraw(userId: string, dto: CreateWithdrawDto) {
    const amount = BigInt(Math.floor(dto.amountUsdt * 100));

    const riskCheck = await this.riskService.checkWithdrawRisk(userId, amount);
    if (!riskCheck.allowed) {
      throw new BadRequestException({ code: 42201, message: riskCheck.reason });
    }

    const withdraw = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.balance < amount) {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }
      if (user.isFrozen) {
        throw new BadRequestException('USER_FROZEN');
      }

      const created = await tx.withdrawal.create({
        data: {
          userId,
          amountUsdt: amount,
          toAddress: dto.toAddress,
          chain: dto.chain,
          status: WithdrawalStatus.PENDING_REVIEW,
          riskScore: riskCheck.score,
          riskReason: riskCheck.reason,
        },
      });

      await this.ledger.applyLedgerTx(tx, {
        userId,
        type: LedgerType.WITHDRAW_FROZEN,
        amount: -amount,
        description: `Withdraw request #${created.id}`,
        withdrawalId: created.id,
      });

      return created;
    });

    return { withdrawId: withdraw.id, status: withdraw.status };
  }

  async approve(withdrawId: string, adminId: string, remark?: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawId } });
    if (!w || w.status !== WithdrawalStatus.PENDING_REVIEW) {
      throw new BadRequestException('Invalid withdraw status');
    }

    // 状态机：PENDING_REVIEW → APPROVED（批准审核，等待打款）
    await this.prisma.withdrawal.update({
      where: { id: withdrawId },
      data: {
        status: WithdrawalStatus.APPROVED,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        paidRemark: remark,
      },
    });
  }

  async markPaid(withdrawId: string, txHash?: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawId } });
    if (!w || w.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException('Invalid withdraw status: must be APPROVED before marking PAID');
    }

    // 状态机：APPROVED → PAID（确认打款完成）
    await this.prisma.withdrawal.update({
      where: { id: withdrawId },
      data: {
        status: WithdrawalStatus.PAID,
        paidAt: new Date(),
        paidRemark: txHash ? `TX: ${txHash}` : undefined,
      },
    });
  }

  async getHistory(userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async reject(withdrawId: string, adminId: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { id: withdrawId } });
      if (!w) throw new BadRequestException('Withdraw not found');
      if (w.status !== WithdrawalStatus.PENDING_REVIEW) {
        throw new BadRequestException('Invalid withdraw status');
      }

      await tx.withdrawal.update({
        where: { id: withdrawId },
        data: {
          status: WithdrawalStatus.REJECTED,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          riskReason: reason,
        },
      });

      await this.ledger.applyLedgerTx(tx, {
        userId: w.userId,
        type: LedgerType.WITHDRAW_REFUND,
        amount: w.amountUsdt,
        description: `Withdraw rejected: ${reason}`,
        withdrawalId: withdrawId,
      });
    });
  }
}