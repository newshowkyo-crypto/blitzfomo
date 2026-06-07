// apps/api/src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      ...user,
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

    const [recentPurchases, recentWithdrawals] = await Promise.all([
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
    ]);

    // No referral table exists yet, so a user's real invite count is 0.
    // Previously this counted ALL platform users, which displayed a fake
    // invite/commission number on every profile. Report the honest value
    // until a real referral relation is added to the schema.
    const referralCount = 0;

    return {
      ...user,
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
      referralCount: referralCount || 0   // placeholder
    };
  }
}