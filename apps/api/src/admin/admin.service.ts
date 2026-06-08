// apps/api/src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { GameService } from '../game/game.service';
import { SystemLogService } from '../system-log/system-log.service';
import { LedgerType } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly ledgerService: LedgerService,
    private readonly gameService: GameService,
    private readonly systemLog: SystemLogService,
    @InjectQueue('bot-purchase') private readonly botQueue: Queue,
  ) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [userCount, totalRecharge, todayRecharge, todayWithdraw, pendingWithdrawals, todayPurchases, gameConfig, gameState] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amountUsdt: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'PAID', paidAt: { gte: today } },
        _sum: { amountUsdt: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { status: 'PAID', paidAt: { gte: today } },
        _sum: { amountUsdt: true },
      }),
      this.prisma.withdrawal.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.purchase.count({ where: { createdAt: { gte: today } } }),
      this.prisma.gameConfig.findUnique({ where: { id: 1 }, select: { activePaymentGateway: true, botEnabled: true } }),
      // 从 Redis 读取实时游戏状态，与 /api/game/state 接口数据源统一
      this.gameService.getCurrentState(),
    ]);

    return {
      totalUsers: userCount,
      totalRecharged: Number(totalRecharge._sum.amountUsdt ?? 0n) / 100,
      todayRecharged: Number(todayRecharge._sum.amountUsdt ?? 0n) / 100,
      todayWithdrawn: Number(todayWithdraw._sum.amountUsdt ?? 0n) / 100,
      todayNetInflow: Number((todayRecharge._sum.amountUsdt ?? 0n) - (todayWithdraw._sum.amountUsdt ?? 0n)) / 100,
      pendingWithdrawals,
      todayPurchases,
      activePaymentGateway: gameConfig?.activePaymentGateway || 'mock',
      botEnabled: gameConfig?.botEnabled || false,
      currentRound: {
        roundNumber: gameState.roundNumber,
        prizePool: gameState.prizePool, // 已是 BF 单位，与游戏状态接口完全一致
        countdown: gameState.countdown,
      },
      onlineUsers: gameState.activeFans, // 活跃用户数（供实时监控使用）
      timestamp: new Date(),
    };
  }

  // 近 N 天充值/提现趋势（按天聚合，真实数据，无数据则为 0）
  async getDashboardTrend(days = 7) {
    const span = Math.min(Math.max(Number(days) || 7, 1), 30);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (span - 1));

    const [payments, withdrawals] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: start } },
        select: { amountUsdt: true, paidAt: true },
      }),
      this.prisma.withdrawal.findMany({
        where: { status: 'PAID', paidAt: { gte: start } },
        select: { amountUsdt: true, paidAt: true },
      }),
    ]);

    const buckets: Record<string, { recharged: number; withdrawn: number }> = {};
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = { recharged: 0, withdrawn: 0 };
    }
    const keyOf = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    for (const p of payments) {
      const k = keyOf(p.paidAt);
      if (k && buckets[k]) buckets[k].recharged += Number(p.amountUsdt) / 100;
    }
    for (const w of withdrawals) {
      const k = keyOf(w.paidAt);
      if (k && buckets[k]) buckets[k].withdrawn += Number(w.amountUsdt) / 100;
    }

    return {
      days: Object.entries(buckets).map(([date, v]) => ({ date, ...v })),
    };
  }

  async getGameConfig() {
    return this.prisma.gameConfig.findUnique({ where: { id: 1 } });
  }

  async updateGameConfig(data: any) {
    const bigintFields = ['initialPrizePool', 'minBuyAmount', 'botMinAmount', 'botMaxAmount'];
    const normalized = { ...data };
    for (const field of bigintFields) {
      if (normalized[field] !== undefined) {
        normalized[field] = BigInt(normalized[field]);
      }
    }

    const updated = await this.prisma.gameConfig.update({
      where: { id: 1 },
      data: { ...normalized, updatedAt: new Date() },
    });
    // 关键：后台修改配置后立即刷新 Redis 缓存
    await this.configService.refreshAllConfigs();
    return updated;
  }

  async listWithdrawals(status?: string) {
    return this.prisma.withdrawal.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { walletAddress: true, nickname: true } } },
    });
  }

  async approveWithdrawal(id: string, adminId: string, remark?: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal || withdrawal.status !== 'PENDING_REVIEW') return withdrawal;

    // 状态机：PENDING_REVIEW → APPROVED（批准审核，等待打款）
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        paidRemark: remark,
      },
    });

    await this.auditService.log({
      adminId,
      action: 'withdraw:approve',
      targetType: 'withdrawal',
      targetId: id,
      after: { status: 'APPROVED', remark },
    });

    await this.systemLog.info('withdraw', `Withdrawal approved (awaiting payout)`, {
      withdrawalId: id,
      userId: withdrawal.userId,
      amountUsdt: withdrawal.amountUsdt.toString(),
      adminId,
      remark: remark ?? null,
    });

    return updated;
  }

  async markWithdrawalPaid(id: string, adminId: string, txHash?: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal || withdrawal.status !== 'APPROVED') {
      throw new Error('Withdrawal must be APPROVED before marking as PAID');
    }

    // 状态机：APPROVED → PAID（确认打款完成）
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidRemark: txHash ? `TX: ${txHash}` : undefined,
      },
    });

    await this.auditService.log({
      adminId,
      action: 'withdraw:mark_paid',
      targetType: 'withdrawal',
      targetId: id,
      after: { status: 'PAID', txHash },
    });

    await this.systemLog.info('withdraw', `Withdrawal marked as paid`, {
      withdrawalId: id,
      userId: withdrawal.userId,
      amountUsdt: withdrawal.amountUsdt.toString(),
      adminId,
      txHash: txHash ?? null,
    });

    return updated;
  }

  async rejectWithdrawal(id: string, adminId: string, reason: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal || withdrawal.status !== 'PENDING_REVIEW') return withdrawal;

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.withdrawal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          riskReason: reason,
        },
      });

      await this.ledgerService.applyLedgerTx(tx, {
        userId: withdrawal.userId,
        type: LedgerType.WITHDRAW_REFUND,
        amount: withdrawal.amountUsdt,
        description: `Withdraw rejected: ${reason}`,
        withdrawalId: id,
      });

      return changed;
    });

    await this.auditService.log({
      adminId,
      action: 'withdraw:reject',
      targetType: 'withdrawal',
      targetId: id,
      after: { reason },
    });

    await this.systemLog.warn('withdraw', `Withdrawal rejected and refunded`, {
      withdrawalId: id,
      userId: withdrawal.userId,
      amountUsdt: withdrawal.amountUsdt.toString(),
      adminId,
      reason,
    });

    return updated;
  }

  // 支付网关相关（简化实现，真实项目应加密存储）
  async getPaymentGateways() {
    const config = await this.prisma.gameConfig.findUnique({ where: { id: 1 } });
    return {
      active: config?.activePaymentGateway || 'mock',
      available: ['mock', 'plisio', 'stripe', 'fireblocks'],
    };
  }

  async activatePaymentGateway(name: string) {
    const updated = await this.prisma.gameConfig.update({
      where: { id: 1 },
      data: { activePaymentGateway: name },
    });
    await this.configService.refreshAllConfigs();
    return updated;
  }

  async updatePaymentGatewayConfig(name: string, config: any) {
    throw new Error('Gateway config update is not yet implemented. Use .env.production to configure payment gateways.');
  }

  // 用户管理
  async listUsers(page: number, pageSize: number, search?: string, status?: string) {
    const term = (search || '').trim();
    const where: any = term
      ? {
          OR: [
            { nickname: { contains: term, mode: 'insensitive' as const } },
            { walletAddress: { contains: term, mode: 'insensitive' as const } },
            { id: term },
          ],
        }
      : {};
    if (status === 'frozen') where.isFrozen = true;
    if (status === 'active') where.isFrozen = false;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getUserDetail(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getUserLedger(userId: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.ledger.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ledger.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async freezeUser(id: string, freeze: boolean, reason?: string, adminId?: string) {
    const result = await this.prisma.user.update({
      where: { id },
      data: { isFrozen: freeze, frozenReason: reason },
    });

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: freeze ? 'user:freeze' : 'user:unfreeze',
        targetType: 'user',
        targetId: id,
        after: { freeze, reason },
      });
    }

    await this.systemLog.warn('user', freeze ? `User frozen` : `User unfrozen`, {
      userId: id,
      frozen: freeze,
      reason: reason ?? null,
      adminId: adminId ?? null,
    });
    return result;
  }

  async adjustUserBalance(userId: string, amount: bigint, reason: string, adminId: string) {
    // 必须走 Ledger
    const result = await this.ledgerService.applyLedger({
      userId,
      type: 'MANUAL_ADJUST',
      amount,
      description: reason,
      meta: { adjustedBy: adminId },
    });

    // 记录审计日志
    await this.auditService.log({
      adminId,
      action: 'user:adjust_balance',
      targetType: 'user',
      targetId: userId,
      after: { amount: amount.toString(), reason },
    });

    await this.systemLog.warn('admin', `Manual balance adjustment`, {
      userId,
      amount: amount.toString(),
      reason,
      adminId,
      newBalance: result.balanceAfter.toString(),
    });

    return { newBalance: Number(result.balanceAfter) / 100 };
  }

  async updateUserNickname(userId: string, nickname: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { nickname },
    });
    return { user };
  }

  // 风控配置
  async getRiskConfig() {
    return this.prisma.riskConfig.findUnique({ where: { id: 1 } });
  }

  async updateRiskConfig(dto: any) {
    const bigintFields = ['withdrawMinAmount', 'withdrawMaxAmountDaily', 'purchaseMaxAmountPerTx', 'largeAmountThreshold'];
    const normalized = { ...dto };
    for (const field of bigintFields) {
      if (normalized[field] !== undefined) {
        normalized[field] = BigInt(normalized[field]);
      }
    }

    const updated = await this.prisma.riskConfig.update({
      where: { id: 1 },
      data: { ...normalized, updatedAt: new Date() },
    });
    await this.configService.refreshAllConfigs();
    return updated;
  }

  // 机器人配置
  async getBotConfig() {
    const cfg = await this.prisma.gameConfig.findUnique({ where: { id: 1 } });
    return {
      botEnabled: cfg?.botEnabled,
      botPurchaseIntervalMs: cfg?.botPurchaseIntervalMs,
      botMinAmount: cfg?.botMinAmount,
      botMaxAmount: cfg?.botMaxAmount,
    };
  }

  async updateBotConfig(body: any) {
    const normalized = { ...body };
    for (const field of ['botMinAmount', 'botMaxAmount']) {
      if (normalized[field] !== undefined) normalized[field] = BigInt(normalized[field]);
    }
    const updated = await this.prisma.gameConfig.update({
      where: { id: 1 },
      data: { ...normalized, updatedAt: new Date() },
    });
    await this.configService.refreshAllConfigs();
    return updated;
  }

  async triggerBotPurchaseOnce(adminId?: string) {
    const cfg = await this.prisma.gameConfig.findUnique({ where: { id: 1 } });
    const botUsers = await this.prisma.user.findMany({
      where: { walletAddress: { startsWith: 'bot:' } },
      take: 50,
    });
    if (botUsers.length === 0) {
      return { success: false, message: 'No bot users. Create bot users first.' };
    }

    const randomUser = botUsers[Math.floor(Math.random() * botUsers.length)];
    const min = Number(cfg?.botMinAmount || 100n);
    const max = Number(cfg?.botMaxAmount || min);
    const amount = Math.floor(Math.random() * (Math.max(max, min) - min + 1) + min);
    const job = await this.botQueue.add('buy', { userId: randomUser.id, amount, manual: true });

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: 'bot:trigger_once',
        targetType: 'config',
        after: { botUserId: randomUser.id, amount, jobId: job.id },
      });
    }

    await this.systemLog.info('bot', `Manual bot purchase triggered`, {
      botUserId: randomUser.id,
      botNickname: randomUser.nickname,
      amount,
      jobId: job.id,
      adminId: adminId ?? null,
    });

    return {
      success: true,
      message: 'Bot purchase queued',
      jobId: job.id,
      bot: randomUser.nickname,
      amount: Number(amount) / 100,
    };
  }

  // 快速创建更多机器人用户（后台运营使用，批量插入提升性能）
  async createBotUsers(count: number = 5) {
    const safeCount = Math.min(Math.max(Number(count) || 1, 1), 50);
    const ts = Date.now().toString(36);
    const botData = Array.from({ length: safeCount }, (_, i) => ({
      walletAddress: `bot:${ts}:${i}:${Math.random().toString(36).slice(2, 8)}`,
      nickname: `Bot_${Math.random().toString(36).substring(2, 8)}`,
      balance: 0n,
    }));

    const result = await this.prisma.user.createMany({ data: botData });
    return { created: result.count, bots: botData.map(b => ({ walletAddress: b.walletAddress, nickname: b.nickname })) };
  }

  // 审计日志
  async listAuditLogs(page: number, pageSize: number, adminId?: string) {
    const where = adminId ? { adminId } : {};
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { username: true } } },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async exportAuditLogsCsv(): Promise<string> {
    const logs = await this.prisma.adminAuditLog.findMany({
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });
    const header = 'id,adminId,action,targetType,targetId,createdAt\n';
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = logs
      .map(l => [l.id, l.adminId, l.action, l.targetType || '', l.targetId || '', l.createdAt?.toISOString?.() ?? ''].map(escape).join(','))
      .join('\n');
    return header + rows;
  }

  // 多语言
  async getLocales() {
    return this.prisma.locale.findMany();
  }

  async updateLocale(lang: string, content: any) {
    return this.prisma.locale.upsert({
      where: { lang },
      update: { content, updatedAt: new Date() },
      create: { lang, content, isDefault: false },
    });
  }

  async setDefaultLocale(lang: string) {
    await this.prisma.locale.updateMany({ data: { isDefault: false } });
    return this.prisma.locale.update({
      where: { lang },
      data: { isDefault: true },
    });
  }

  // 订单/支付管理 - 手动标记支付 (CODEX 要求的 Admin 功能)
  async listPayments(page: number = 1, pageSize: number = 50, status?: string) {
    const where = status ? { status: status as any } : {};
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { walletAddress: true, nickname: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // 实时游戏状态（后台实时监控页使用，与 /api/game/state 同源 Redis）
  async getGameState() {
    return this.gameService.getCurrentState();
  }

  // 最近购买流（后台实时监控页使用）
  async getRecentPurchases(limit = 20) {
    return this.gameService.getRecentPurchases(Math.min(Math.max(Number(limit) || 20, 1), 100));
  }

  // 轮次分页列表
  async listRounds(page: number = 1, pageSize: number = 10) {
    const p = Math.max(Number(page) || 1, 1);
    const size = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
    const [rows, total] = await Promise.all([
      this.prisma.round.findMany({
        skip: (p - 1) * size,
        take: size,
        orderBy: { roundNumber: 'desc' },
      }),
      this.prisma.round.count(),
    ]);
    // 兼容前端字段命名（platformAmount / winnerId）
    const items = rows.map((r) => ({
      ...r,
      platformAmount: r.platformFee,
      winnerId: r.winnerUserId,
    }));
    return { items, total, page: p, pageSize: size };
  }

  // 轮次详情 + 购买记录
  async getRoundDetail(id: string) {
    const round = await this.prisma.round.findUnique({ where: { id } });
    if (!round) return null;
    const purchases = await this.prisma.purchase.findMany({
      where: { roundId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { nickname: true, walletAddress: true } } },
    });
    return {
      ...round,
      platformAmount: round.platformFee,
      winnerId: round.winnerUserId,
      purchases,
    };
  }

  // 系统日志分页（system_logs 表为空时返回稳定空分页，绝不报错）
  async listSystemLogs(page: number = 1, pageSize: number = 10, level?: string) {
    const p = Math.max(Number(page) || 1, 1);
    const size = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
    const where = level && level !== 'all' ? { level } : {};
    try {
      const [items, total] = await Promise.all([
        this.prisma.systemLog.findMany({
          where,
          skip: (p - 1) * size,
          take: size,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.systemLog.count({ where }),
      ]);
      return { items, total, page: p, pageSize: size };
    } catch {
      // 表缺失/查询异常时退化为稳定空分页，保证后台页面不崩
      return { items: [], total: 0, page: p, pageSize: size };
    }
  }

  // 系统日志 CSV 导出（空数据也返回合法 CSV 头）
  async exportSystemLogsCsv(level?: string): Promise<string> {
    const header = 'id,level,module,message,createdAt\n';
    try {
      const where = level && level !== 'all' ? { level } : {};
      const logs = await this.prisma.systemLog.findMany({
        where,
        take: 10000,
        orderBy: { createdAt: 'desc' },
      });
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = logs
        .map((l) => [l.id, l.level, l.module, l.message, l.createdAt.toISOString()].map(escape).join(','))
        .join('\n');
      return header + rows;
    } catch {
      return header;
    }
  }

  async markPaymentPaid(paymentId: string, adminId: string, remark?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'PAID') return payment;
    if (payment.status !== 'PENDING') {
      throw new Error(`Only PENDING payments can be manually marked paid, current=${payment.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      if (changed.count !== 1) {
        return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      }

      await this.ledgerService.applyLedgerTx(tx, {
        userId: payment.userId,
        type: 'RECHARGE',
        amount: payment.amountUsdt,
        description: `Manual mark paid by admin: ${remark || ''}`,
        paymentId,
        meta: { markedBy: adminId, remark },
      });

      return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    });

    await this.auditService.log({
      adminId,
      action: 'payment:manual_mark_paid',
      targetType: 'payment',
      targetId: paymentId,
      after: { status: 'PAID', remark },
    });

    return updated;
  }
}
