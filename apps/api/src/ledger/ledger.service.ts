// apps/api/src/ledger/ledger.service.ts
// Blitz Finale 资金核心服务
//
// 【铁律】
// 1. 任何余额变更（充值、购买、中奖、提现冻结、退款、后台调整）**必须**走此服务
// 2. 必须同时写入 ledger 不可变流水 + 更新 users.balance
// 3. balance_after 必须严格等于该用户所有 ledger 累计
// 4. 所有写操作必须记录审计上下文（谁、在哪、为什么）
//
// 严禁在任何其他地方直接操作 users.balance 或 ledger 表！

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, LedgerType } from '@prisma/client';

export interface ApplyLedgerParams {
  userId: string;
  type: LedgerType;
  amount: bigint;                    // 正数=收入，负数=支出（最小单位）
  description: string;
  roundId?: string;
  purchaseId?: string;
  paymentId?: string;
  withdrawalId?: string;
  meta?: Record<string, any>;        // 风控原因、操作人、ip 等
  actorAdminId?: string;             // 后台操作人（仅 MANUAL_ADJUST 等）
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 唯一余额变更入口（核心中的核心）
   *
   * 执行流程：
   * 1. 开启事务
   * 2. 读取用户当前 balance（FOR UPDATE 锁）
   * 3. 计算 balanceAfter
   * 4. 写入 ledger 一条不可变记录
   * 5. 更新 users.balance
   * 6. 提交事务
   *
   * @throws BadRequestException 当余额不足且为负向操作时
   */
  async applyLedgerTx(tx: Prisma.TransactionClient, params: ApplyLedgerParams): Promise<{ balanceAfter: bigint }> {
    const { userId, type, amount, description, meta = {} } = params;

    if (amount === 0n) {
      throw new BadRequestException('Ledger amount cannot be zero');
    }

    const lockedRows = await tx.$queryRaw<Array<{ balance: bigint }>>`
      SELECT balance FROM users WHERE id = ${userId} FOR UPDATE
    `;
    const user = lockedRows[0];

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore + amount;

    if (amount < 0n && balanceAfter < 0n && type !== LedgerType.MANUAL_ADJUST) {
      throw new BadRequestException('Insufficient balance for this operation');
    }

    await tx.ledger.create({
      data: {
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        roundId: params.roundId,
        purchaseId: params.purchaseId,
        paymentId: params.paymentId,
        withdrawalId: params.withdrawalId,
        meta: meta as Prisma.JsonObject,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    });

    if (
      type === LedgerType.MANUAL_ADJUST ||
      type === LedgerType.WITHDRAW_FROZEN ||
      Math.abs(Number(amount)) > 1000000
    ) {
      this.logger.warn(`[LEDGER] Large/Sensitive operation: ${type} user=${userId} amount=${amount}`, {
        description,
        meta,
        actorAdminId: params.actorAdminId,
      });
    }

    return { balanceAfter };
  }

  async applyLedger(params: ApplyLedgerParams): Promise<{ balanceAfter: bigint }> {
    return this.prisma.$transaction((tx) => this.applyLedgerTx(tx, params));
  }

  /**
   * 批量查询用户账本（用于个人中心 + Admin 对账）
   */
  async getUserLedger(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.ledger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledger.count({ where: { userId } }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * 验证用户余额一致性（对账工具）
   * 生产环境可定时跑或在结算后抽查
   */
  async verifyBalanceConsistency(userId: string): Promise<boolean> {
    const [user, ledgerSum] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { balance: true } }),
      this.prisma.ledger.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
    ]);

    const calculated = ledgerSum._sum.amount ?? 0n;
    const stored = user?.balance ?? 0n;

    if (calculated !== stored) {
      this.logger.error(`[LEDGER] BALANCE MISMATCH user=${userId} stored=${stored} calculated=${calculated}`);
      return false;
    }
    return true;
  }
}