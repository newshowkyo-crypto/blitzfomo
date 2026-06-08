// apps/api/src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private buildReferralCode(userId: string) {
    return `BF${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  }

  private async ensureRoadKol(userId: string) {
    const referralCode = this.buildReferralCode(userId);
    await this.prisma.roadKol.upsert({
      where: { referralCode },
      update: { inviterId: userId, status: 'ACTIVE' },
      create: {
        seasonCode: 'WC2026',
        referralCode,
        inviterId: userId,
        status: 'ACTIVE',
      },
    });
    return referralCode;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        nickname: true,
        balance: true,
        totalPurchased: true,
        totalWon: true,
        createdAt: true,
      },
    });

    if (!user) return null;

    const referralCode = await this.ensureRoadKol(userId);

    return {
      ...user,
      referralCode,
      balance: Number(user.balance) / 100,
      totalPurchased: Number(user.totalPurchased) / 100,
      totalWon: Number(user.totalWon) / 100,
    };
  }

  async updateProfile(userId: string, body: { nickname?: string }) {
    const data: any = {};
    if (body.nickname) data.nickname = body.nickname;

    if (Object.keys(data).length === 0) return this.getProfile(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return this.getProfile(userId);
  }

  // 产品级增强： richer profile data for wallet/profile pages
  async getRichProfile(userId: string) {
    const user = await this.getProfile(userId);
    if (!user) return null;

    const referralCode = await this.ensureRoadKol(userId);

    const [recentPurchases, recentWithdrawals, referralRows, commissionAgg] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { amount: true, createdAt: true, roundId: true }
      }),
      this.prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { amountUsdt: true, status: true, createdAt: true }
      }),
      this.prisma.roadReferralCommission.groupBy({
        by: ['referredUserId'],
        where: { inviterId: userId, seasonCode: 'WC2026' },
      }),
      this.prisma.roadReferralCommission.aggregate({
        where: { inviterId: userId, seasonCode: 'WC2026', status: { not: 'CANCELLED' } },
        _sum: { commissionAmount: true },
      }),
    ]);

    const referralCount = referralRows.length;
    const referralCommission = Number(commissionAgg._sum.commissionAmount ?? 0n) / 100;

    return {
      ...user,
      referralCode,
      referralCommission,
      recentActivity: {
        purchases: recentPurchases.map(p => ({
          amount: Number(p.amount) / 100,
          date: p.createdAt,
          roundId: p.roundId
        })),
        withdrawals: recentWithdrawals.map(w => ({
          amount: Number(w.amountUsdt) / 100,
          status: w.status,
          date: w.createdAt
        }))
      },
      referralCount
    };
  }
}
